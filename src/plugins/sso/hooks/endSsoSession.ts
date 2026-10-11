import { cookies } from "next/headers"
import type { CollectionAfterLogoutHook } from "payload"

import { getAuth } from "../auth"
import { hasSessionCookie } from "../strategy"
import type { ResolvedSsoConfig } from "../types"

/**
 * Payload's logout only clears its own token. Without this, the SSO session cookie would
 * sign the person straight back in on their next request.
 */
export function endSsoSession(config: ResolvedSsoConfig): CollectionAfterLogoutHook {
  return async ({ req }) => {
    if (!hasSessionCookie(req.headers, config.cookieName)) return

    try {
      const auth = await getAuth(req.payload, config)
      await auth.api.signOut({ headers: req.headers })
    } catch (err) {
      req.payload.logger.warn({ err }, "[sso] couldn't delete the session on logout")
    }

    // Better Auth's own Set-Cookie went to a response nobody sends; clear it on Payload's.
    try {
      const store = await cookies()
      store.set(config.cookieName, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax" })
    } catch {
      // No request scope (the Local API): there is no browser to clear a cookie in.
    }
  }
}
