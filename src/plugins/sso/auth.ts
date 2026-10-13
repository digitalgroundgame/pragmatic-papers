import type { PostgresAdapter } from "@payloadcms/db-postgres"
import type { betterAuth as BetterAuth } from "better-auth"
import type { Payload } from "payload"

import { AUTH_ENDPOINT_PATH, DISABLED_PATHS, TABLES } from "./constants"
import { destinyPlugin, type DestinyProfile } from "./destiny"
import { linkingPlugin } from "./linking"
import { payloadUserCookiePlugin } from "./payloadUserCookie"
import { isPlaceholderEmail, PLACEHOLDER_EMAIL_DOMAIN, placeholderEmail } from "./placeholderEmail"
import type { ResolvedSsoConfig, SsoProviderId } from "./types"

type Pool = PostgresAdapter["pool"]

/**
 * The address of the user a Destiny.gg account is linked to, which it signs in as.
 * Destiny.gg shares no address, so an account nobody has linked has none here (null).
 */
export async function destinyEmail(
  pool: Pool,
  usersTable: string,
  profile: DestinyProfile,
): Promise<string | null> {
  const linked = await pool.query<{ email: string }>(
    `select u.email from "${TABLES.account}" a join "${usersTable}" u on u.id = a.user_id
     where a.provider_id = 'destiny' and a.account_id = $1 limit 1`,
    [String(profile.userId)],
  )
  return linked.rows[0]?.email ?? null
}

/**
 * Gives a member whose address is a placeholder the one a provider they've just linked has
 * verified, marked verified, unless another user already has it. Their placeholder came from
 * Destiny.gg, which shares no address; this is how they get a real one.
 */
export async function adoptVerifiedEmail(
  pool: Pool,
  usersTable: string,
  userId: string | number,
  email: string,
): Promise<void> {
  if (isPlaceholderEmail(email)) return
  await pool.query(
    `update "${usersTable}" set email = $1, email_verified = true, updated_at = now()
     where id = $2 and email like $3
     and not exists (select 1 from "${usersTable}" where lower(email) = $1)`,
    [email.toLowerCase(), Number(userId), `%@${PLACEHOLDER_EMAIL_DOMAIN}`],
  )
}

function createAuth(betterAuth: typeof BetterAuth, payload: Payload, config: ResolvedSsoConfig) {
  const { pool } = payload.db as unknown as PostgresAdapter
  const baseURL = config.baseURL()
  const secure = baseURL.startsWith("https://")

  const { signUp } = config
  const { destiny, ...builtIn } = config.providers()
  const socialProviders = Object.fromEntries(
    Object.entries(builtIn)
      .filter(([, credentials]) => credentials)
      .map(([id, credentials]) => [
        id,
        // Signing in never creates a user by accident. With sign-up off, a provider login
        // only ever attaches to a user who exists. With it on, only a sign-in that asks for
        // it (`requestSignUp: true`) may create one, and the admin's login page never asks.
        signUp
          ? { ...credentials, disableImplicitSignUp: true }
          : { ...credentials, disableSignUp: true },
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
    plugins: [
      linkingPlugin(),
      payloadUserCookiePlugin(payload, config, secure),
      // Destiny.gg isn't one of Better Auth's built-in providers.
      ...(destiny
        ? [
            destinyPlugin({
              ...destiny,
              signUp: Boolean(signUp),
              // Someone new gets a placeholder to sign up with (`placeholderEmail.ts`).
              emailFor: async (profile) =>
                (await destinyEmail(pool, config.usersSlug, profile)) ??
                (signUp ? placeholderEmail("destiny", profile.userId) : null),
            }),
          ]
        : []),
    ],
    // Payload's users table, read for id, email and name. Better Auth writes
    // `email_verified` when a provider vouches for an address, and inserts a row only for a
    // sign-up (`signUp`), which Payload then finishes (`signUp.afterCreate`).
    user: {
      modelName: config.usersSlug,
      // A member who signed up with Destiny.gg and links Google or Discord takes the address
      // that provider verified in place of their placeholder.
      validateUserInfo: async ({ user, source }) => {
        if (
          source.action === "link-account" &&
          user.emailVerified === true &&
          typeof user.email === "string" &&
          user.id !== undefined
        ) {
          await adoptVerifiedEmail(pool, config.usersSlug, String(user.id), user.email)
        }
      },
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
        create: {
          // Checked again here, so no path to an insert gets past it: sign-up must be
          // configured and open right now, and the provider must have verified the address.
          // An unverified one could be someone else's, and their later sign-in with it would
          // be linked to this account (`accountLinking`). The one exception is Destiny.gg's
          // placeholder, which is made from its account id and belongs to nobody else.
          before: async (user, ctx) => {
            const placeholder = ctx?.params?.id === "destiny" && isPlaceholderEmail(user.email)
            if (
              !signUp ||
              !(user.emailVerified || placeholder) ||
              !(await signUp.enabled({ payload }))
            ) {
              return false
            }
            return { data: { ...user, ...signUp.columns?.() } }
          },
          after: async (user) => {
            await signUp?.afterCreate?.({ payload, userId: String(user.id) })
          },
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
      accountLinking: {
        // A first provider login attaches to the user with the same address, when the
        // provider says the address is verified. Better Auth also wants the local address
        // verified, to stop someone registering a victim's address and waiting. Here a user
        // is created either by an admin, who chose the address, or by a sign-up, whose
        // address a provider verified: nobody can register an address they don't hold.
        enabled: true,
        requireLocalEmailVerified: false,
        // Destiny.gg vouches for no address: the one it signs in with is that of the user
        // its account is already linked to (`destinyEmail`), so it's trusted to link.
        trustedProviders: ["destiny"],
        // Linking from the account page (`linkingPlugin`): the signed-in user chose the
        // account, so its address needn't match theirs (Destiny.gg's has none at all).
        allowDifferentEmails: true,
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
