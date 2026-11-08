import type { BetterAuthPlugin } from "better-auth"
import { createAuthMiddleware } from "better-auth/api"
import type { CollectionSlug, Payload } from "payload"

import type { SignedInUser } from "./session"
import type { ResolvedSsoConfig } from "./types"

/**
 * Sets the cookie the cache rules look for whenever a sign-in makes a session for one of
 * Payload's users, and clears it for anyone else and on sign-out. Every session also gets the
 * signed-in cookie the page's scripts read, which sign-out clears.
 */
export function payloadUserCookiePlugin(
  payload: Payload,
  config: ResolvedSsoConfig,
  secure: boolean,
): BetterAuthPlugin {
  return {
    id: "payload-user-cookie",
    hooks: {
      after: [
        {
          matcher: () => true,
          handler: createAuthMiddleware(async (ctx) => {
            const attributes = { path: "/", httpOnly: true, sameSite: "lax", secure } as const
            const clear = () =>
              ctx.setCookie(config.payloadUserCookie, "", { ...attributes, maxAge: 0 })

            const created = ctx.context.newSession
            if (created) {
              ctx.setCookie(config.signedInCookie, "1", {
                ...attributes,
                httpOnly: false,
                maxAge: config.sessionSeconds,
              })
              const user = await payload.findByID({
                collection: config.usersSlug as CollectionSlug,
                id:
                  payload.db.defaultIDType === "number" ? Number(created.user.id) : created.user.id,
                depth: 0,
                overrideAccess: true,
                disableErrors: true,
              })
              if (user && config.isPayloadUser(user as unknown as SignedInUser)) {
                ctx.setCookie(config.payloadUserCookie, "1", {
                  ...attributes,
                  maxAge: config.sessionSeconds,
                })
              } else {
                clear()
              }
            } else if (ctx.path === "/sign-out") {
              clear()
              ctx.setCookie(config.signedInCookie, "", {
                ...attributes,
                httpOnly: false,
                maxAge: 0,
              })
            }
          }),
        },
      ],
    },
  }
}
