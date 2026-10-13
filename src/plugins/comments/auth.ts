import type { PostgresAdapter } from "@payloadcms/db-postgres"
import type { betterAuth as BetterAuth } from "better-auth"
import type { Payload } from "payload"

import { DISABLED_PATHS, READER_AUTH_PATH, READERS_SLUG, TABLES } from "./constants"
import type { ReaderProviderId, ResolvedCommentsConfig } from "./types"

/** Better Auth wants a name; a provider that shares none gets this, never the address. */
export const FALLBACK_NAME = "Reader"

function createReaderAuth(
  betterAuth: typeof BetterAuth,
  payload: Payload,
  config: ResolvedCommentsConfig,
) {
  const { pool } = payload.db as unknown as PostgresAdapter
  const baseURL = config.baseURL()
  const secure = baseURL.startsWith("https://")

  const socialProviders = Object.fromEntries(
    Object.entries(config.providers()).filter(([, credentials]) => credentials),
  )

  return betterAuth({
    baseURL,
    basePath: `${payload.config.routes.api}${READER_AUTH_PATH}`,
    secret: config.secret(),
    // Payload's node-postgres pool, which Better Auth queries through its Kysely adapter.
    database: pool,
    telemetry: { enabled: false },
    disabledPaths: DISABLED_PATHS,
    // Unlike the staff sign-in, a first provider login creates the reader.
    socialProviders,
    user: {
      modelName: READERS_SLUG,
      fields: {
        emailVerified: "email_verified",
        image: "avatar_url",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
      additionalFields: {
        banned: { type: "boolean", required: false, input: false, defaultValue: false },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({
            data: { ...user, name: user.name?.trim() || FALLBACK_NAME },
          }),
        },
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
      // A second provider with the same verified address joins the first one's reader, as
      // long as that provider vouches for the address (Better Auth's default).
      accountLinking: { enabled: true },
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
      database: { generateId: "serial" },
      // One cookie name everywhere, so it can be told apart from the staff session's; the
      // Secure attribute is still set over HTTPS.
      useSecureCookies: false,
      defaultCookieAttributes: { secure },
      cookies: { session_token: { name: config.cookieName } },
    },
  })
}

export type ReaderAuth = ReturnType<typeof createReaderAuth>

const instances = new WeakMap<Payload, Promise<ReaderAuth>>()

/**
 * This Payload instance's Better Auth for readers, created on first use. Better Auth is
 * imported here rather than at the top: the Payload config imports this plugin, and every
 * page imports the config.
 */
export function getReaderAuth(
  payload: Payload,
  config: ResolvedCommentsConfig,
): Promise<ReaderAuth> {
  let auth = instances.get(payload)
  if (!auth) {
    auth = import("better-auth").then(({ betterAuth }) =>
      createReaderAuth(betterAuth, payload, config),
    )
    instances.set(payload, auth)
  }
  return auth
}

/** The providers that have credentials, in the order the config lists them. */
export function configuredProviders(config: ResolvedCommentsConfig): ReaderProviderId[] {
  return Object.entries(config.providers())
    .filter(([, credentials]) => credentials)
    .map(([id]) => id as ReaderProviderId)
}
