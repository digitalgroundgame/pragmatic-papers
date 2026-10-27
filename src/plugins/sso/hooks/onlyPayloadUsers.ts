import { APIError, type CollectionBeforeLoginHook } from "payload"

import type { ResolvedSsoConfig } from "../types"

/**
 * Refuses Payload's own password login to anyone `isPayloadUser` doesn't accept, the same
 * people the SSO strategy keeps out of `req.user`. Without it a member who set a password
 * could sign in to Payload with it, and get whatever access rules grant a logged-in user.
 */
export function onlyPayloadUsers(config: ResolvedSsoConfig): CollectionBeforeLoginHook {
  return ({ user }) => {
    if (!config.isPayloadUser(user as Record<string, unknown>)) {
      throw new APIError("The email or password provided is incorrect.", 401, null, true)
    }
    return user
  }
}
