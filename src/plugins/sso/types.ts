import type { Payload } from "payload"

/**
 * A sign-in provider: Google and Discord are built in to Better Auth, Destiny.gg is ours
 * (`destiny.ts`).
 */
export type SsoProviderId = "google" | "discord" | "destiny"

/** A row of the Linked accounts panel: a configured provider, and whether it's linked. */
export interface LinkedProvider {
  id: SsoProviderId
  label: string
  linked: boolean
}

/** An OAuth application's credentials, from the provider's developer console. */
export interface SsoProviderCredentials {
  clientId: string
  clientSecret: string
}

export interface SsoPluginConfig {
  /**
   * Leaves the schema in place (the `emailVerified` field, and the tables
   * `ssoAfterSchemaInit` adds) but registers no endpoint, strategy, hook or button.
   */
  disabled?: boolean
  /**
   * Whether single sign-on is switched on right now. Asked on every request, so a feature
   * flag takes effect without a restart. Off: the endpoints answer 404, no button is
   * rendered and a session cookie from before is ignored.
   */
  enabled?: (args: { payload: Payload }) => boolean | Promise<boolean>
  /**
   * The providers to offer, each with its credentials, or null while it isn't configured.
   * Read once, when the first request needs it.
   */
  providers: () => Partial<Record<SsoProviderId, SsoProviderCredentials | null>>
  /** The site's public origin, which the providers redirect back to. */
  baseURL: () => string
  /** Signs cookies and encrypts stored provider tokens. */
  secret: () => string
  /** The auth collection people sign in to. Default `users`. */
  usersSlug?: string
  /**
   * The session cookie's name. Default `pp-session`. Keep `payload-token` out of it: the
   * cache rules skip the edge for any cookie with that in its name, and a member should get
   * the same cached pages as everyone else.
   */
  cookieName?: string
  /**
   * A cookie set beside the session for users `isPayloadUser` accepts, so cache rules can
   * send them past the edge. Default `payload-token-sso`. It carries no authority: nothing
   * reads it but the cache rules.
   */
  payloadUserCookie?: string
  /**
   * Whether a signed-in user becomes Payload's `req.user`, with whatever every access rule
   * grants a logged-in user, and may use Payload's own password login. Default: everyone.
   * Anyone it refuses is still signed in, as far as `getSignedInUser` is concerned, so the
   * site's own features (comments, their account page) know them; Payload treats them as
   * anonymous.
   */
  isPayloadUser?: (user: Record<string, unknown>) => boolean
  /**
   * Lets someone with no account here create one by signing in with a provider. Off by
   * default: a provider login then only ever finds a user who already exists.
   *
   * A sign-up happens only when the sign-in asks for one (`requestSignUp: true`, which the
   * admin's login page never sends) and `enabled` says yes.
   */
  signUp?: SsoSignUpConfig
  /**
   * Where the signed-in user manages their account on the site, for someone `isPayloadUser`
   * refuses (members). Linking a provider from there comes back to it. Default `/account`.
   */
  accountPath?: string
  /** How long a sign-in lasts, in seconds. Default 7 days. */
  sessionSeconds?: number
  /**
   * Required columns on the users table that Better Auth knows nothing about (a slug, say).
   * It never fills them, since it never creates a user, but its startup schema check refuses
   * a table with a required column it couldn't insert, so they're named to it here.
   */
  requiredUserColumns?: string[]
}

export interface SsoSignUpConfig {
  /** Whether sign-ups are open right now. Asked on each one. */
  enabled: (args: { payload: Payload }) => boolean | Promise<boolean>
  /**
   * Values for the users table's required columns (`requiredUserColumns`), which Better
   * Auth writes in the same insert as the name and address.
   */
  columns?: () => Record<string, unknown>
  /**
   * Finishes a new user once Better Auth has created their row, through Payload: setting
   * their roles, say. Runs before the sign-in completes.
   */
  afterCreate?: (args: { payload: Payload; userId: string }) => Promise<void>
}

export type ResolvedSsoConfig = Required<Omit<SsoPluginConfig, "disabled" | "signUp">> &
  Pick<SsoPluginConfig, "signUp">
