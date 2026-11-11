import type { AuthStrategy, AuthStrategyResult } from "payload"

import { isAllowedOrigin, sessionUser } from "./session"
import type { ResolvedSsoConfig } from "./types"

export { hasSessionCookie } from "./session"

/**
 * Lets a Better Auth session sign a person in to Payload, when `isPayloadUser` accepts
 * them. It runs after Payload's own strategies, so a password login still works when a
 * provider is down. Anyone it refuses (a member) is anonymous to Payload: no admin, and none
 * of what access rules grant a logged-in user. So is a request from an origin outside Payload's
 * `csrf` list, as it is to Payload's own cookie.
 */
export function ssoStrategy(config: ResolvedSsoConfig): AuthStrategy {
  return {
    name: "sso",
    authenticate: async ({ payload, headers }) => {
      // The session cookie makes someone Payload's user only from an origin Payload would
      // take its own login cookie from.
      if (!isAllowedOrigin(headers, payload.config.csrf ?? [])) return { user: null }
      const user = await sessionUser(payload, headers, config)
      if (!user || !config.isPayloadUser(user)) return { user: null }
      return {
        user: { ...user, collection: config.usersSlug, _strategy: "sso" },
      } as AuthStrategyResult
    },
  }
}
