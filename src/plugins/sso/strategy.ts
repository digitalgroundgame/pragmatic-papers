import type { AuthStrategy, AuthStrategyResult } from "payload"

import { sessionUser } from "./session"
import type { ResolvedSsoConfig } from "./types"

export { hasSessionCookie } from "./session"

/**
 * Lets a Better Auth session sign a person in to Payload, when `isPayloadUser` accepts
 * them. It runs after Payload's own strategies, so a password login still works when a
 * provider is down. Anyone it refuses (a member) is anonymous to Payload: no admin, and none
 * of what access rules grant a logged-in user.
 */
export function ssoStrategy(config: ResolvedSsoConfig): AuthStrategy {
  return {
    name: "sso",
    authenticate: async ({ payload, headers }) => {
      const user = await sessionUser(payload, headers, config)
      if (!user || !config.isPayloadUser(user)) return { user: null }
      return {
        user: { ...user, collection: config.usersSlug, _strategy: "sso" },
      } as AuthStrategyResult
    },
  }
}
