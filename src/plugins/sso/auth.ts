import type { PostgresAdapter } from "@payloadcms/db-postgres"
import type { betterAuth as BetterAuth } from "better-auth"
import type { Payload } from "payload"

import { AUTH_ENDPOINT_PATH, DISABLED_PATHS, TABLES } from "./constants"
import type { ResolvedSsoConfig, SsoProviderId } from "./types"

function createAuth(betterAuth: typeof BetterAuth, payload: Payload, config: ResolvedSsoConfig) {
  const { pool } = payload.db as unknown as PostgresAdapter
  const baseURL = config.baseURL()
  const secure = baseURL.startsWith("https://")

  const socialProviders = Object.fromEntries(
    Object.entries(config.providers())
      .filter(([, credentials]) => credentials)
      .map(([id, credentials]) => [
        id,
        // Nobody becomes a user by signing in: an account is made in the admin first, and a
        // provider login only ever attaches to one that exists.
        { ...credentials, disableSignUp: true },
      ]),
  )

  return betterAuth({
    baseURL,
    basePath: `${payload.config.routes.api}${AUTH_ENDPOINT_PATH}`,
    secret: config.secret(),
    // A node-postgres pool: Better Auth queries it through its built-in Kysely adapter, on
    // the connections Payload already holds.
    database: pool,
    telemetry: { enabled: false },
    disabledPaths: DISABLED_PATHS,
    socialProviders,
    // Payload's users table, read for id, email and name. Better Auth's only write to it is
    // `email_verified`, when a provider vouches for the address.
    user: {
      modelName: config.usersSlug,
      fields: {
        emailVerified: "email_verified",
        image: "avatar_url",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
      additionalFields: Object.fromEntries(
        config.requiredUserColumns.map((column) => [
          column,
          { type: "string", required: false, input: false, returned: false } as const,
        ]),
      ),
    },
    databaseHooks: {
      user: {
        // Users are Payload's to create. Sign-up is already off for every provider; this
        // refuses any other path to an insert too.
        create: { before: async () => false },
      },
    },
    session: {
      modelName: TABLES.session,
      expiresIn: config.sessionSeconds,
      fields: {
        userId: "user_id",
        expiresAt: "expires_at",
        ipAddress: "ip_address",
        userAgent: "user_agent",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    account: {
      modelName: TABLES.account,
      // We never call the providers' APIs, so their tokens are only kept encrypted.
      encryptOAuthTokens: true,
      fields: {
        providerId: "provider_id",
        accountId: "account_id",
        userId: "user_id",
        accessToken: "access_token",
        refreshToken: "refresh_token",
        idToken: "id_token",
        accessTokenExpiresAt: "access_token_expires_at",
        refreshTokenExpiresAt: "refresh_token_expires_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
      accountLinking: {
        // A first provider login attaches to the user with the same address, when the
        // provider says the address is verified. Better Auth also wants the local address
        // verified, to stop someone registering a victim's address and waiting; here only
        // an admin creates users, so the local address is one an admin chose.
        enabled: true,
        requireLocalEmailVerified: false,
      },
    },
    verification: {
      modelName: TABLES.verification,
      fields: {
        expiresAt: "expires_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    advanced: {
      database: {
        // Payload's ids are serial integers, and so are these tables'.
        generateId: "serial",
      },
      // No `__Secure-` name prefix, so the session cookie has one name everywhere and the
      // cache rules can look for it; the Secure attribute is still set over HTTPS.
      useSecureCookies: false,
      defaultCookieAttributes: { secure },
      cookies: { session_token: { name: config.cookieName } },
    },
  })
}

export type SsoAuth = ReturnType<typeof createAuth>

const instances = new WeakMap<Payload, Promise<SsoAuth>>()

/**
 * This Payload instance's Better Auth, created on first use, once its pool is connected.
 * Better Auth itself is imported here rather than at the top: the Payload config imports
 * this plugin, and every page imports the config.
 */
export function getAuth(payload: Payload, config: ResolvedSsoConfig): Promise<SsoAuth> {
  let auth = instances.get(payload)
  if (!auth) {
    auth = import("better-auth").then(({ betterAuth }) => createAuth(betterAuth, payload, config))
    instances.set(payload, auth)
  }
  return auth
}

/** The providers that have credentials, in the order the config lists them. */
export function configuredProviders(config: ResolvedSsoConfig): SsoProviderId[] {
  return Object.entries(config.providers())
    .filter(([, credentials]) => credentials)
    .map(([id]) => id as SsoProviderId)
}
