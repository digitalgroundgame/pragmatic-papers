import type { Payload } from "payload"

import type { PluginEnabled } from "@/utilities/registerPlugin"

/** A sign-in provider Better Auth has built in. */
export type SsoProviderId = "google" | "discord"

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
  enabled?: PluginEnabled
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
   * The session cookie's name. Default `payload-token-sso`: cache rules that look for
   * `payload-token` in the Cookie header then treat an SSO session as a signed-in editor too.
   */
  cookieName?: string
  /** How long a sign-in lasts, in seconds. Default 7 days. */
  sessionSeconds?: number
  /**
   * Required columns on the users table that Better Auth knows nothing about (a slug, say).
   * It never fills them, since it never creates a user, but its startup schema check refuses
   * a table with a required column it couldn't insert, so they're named to it here.
   */
  requiredUserColumns?: string[]
}

export type ResolvedSsoConfig = Required<Omit<SsoPluginConfig, "disabled" | "enabled">> & {
  enabled: (args: { payload: Payload }) => Promise<boolean>
}
