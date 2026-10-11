import type { AuthStrategy, AuthStrategyResult, CollectionSlug } from "payload"

import { getAuth } from "./auth"
import type { ResolvedSsoConfig } from "./types"

/** Whether the request carries the SSO session cookie at all. */
export function hasSessionCookie(headers: Headers, cookieName: string): boolean {
  return (headers.get("cookie") ?? "")
    .split(";")
    .some((pair) => pair.trim().startsWith(`${cookieName}=`))
}

/**
 * Lets a Better Auth session sign a person in to Payload. It runs after Payload's own
 * strategies, so a password login still works when a provider is down.
 */
export function ssoStrategy(config: ResolvedSsoConfig): AuthStrategy {
  return {
    name: "sso",
    authenticate: async ({ payload, headers }) => {
      // Most requests have no session: answer them without touching the database.
      if (!hasSessionCookie(headers, config.cookieName)) return { user: null }

      try {
        if (!(await config.enabled({ payload }))) return { user: null }

        // Never refreshed here: a refresh writes the cookie, and a cookie written during one
        // of the admin's server actions invalidates the router cache, which re-runs the
        // action. The session simply lasts `sessionSeconds` from sign-in.
        const auth = await getAuth(payload, config)
        const session = await auth.api.getSession({
          headers,
          query: { disableRefresh: true },
        })
        if (!session) return { user: null }

        const user = await payload.findByID({
          collection: config.usersSlug as CollectionSlug,
          id: payload.db.defaultIDType === "number" ? Number(session.user.id) : session.user.id,
          depth: 0,
          disableErrors: true,
        })
        if (!user) return { user: null }

        return {
          user: { ...user, collection: config.usersSlug, _strategy: "sso" },
        } as AuthStrategyResult
      } catch (err) {
        payload.logger.error({ err }, "[sso] couldn't read the session")
        return { user: null }
      }
    },
  }
}
