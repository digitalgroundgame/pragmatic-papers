import type { CollectionSlug, Payload, PayloadRequest } from "payload"

import { isPluginOn } from "@/utilities/registerPlugin"

import { getAuth } from "./auth"
import { DEFAULT_COOKIE_NAME, DEFAULT_PAYLOAD_USER_COOKIE } from "./constants"
import type { ResolvedSsoConfig, SsoPluginConfig } from "./types"

/** A row of the users collection, as Payload returns it. */
export type SignedInUser = Record<string, unknown> & { id: number | string; collection?: string }

/** The plugin's options with their defaults filled in. */
export function resolveSsoConfig(options: SsoPluginConfig): ResolvedSsoConfig {
  const { disabled: _disabled, ...given } = options
  // An option passed as undefined keeps its default.
  const rest = Object.fromEntries(
    Object.entries(given).filter(([, value]) => value !== undefined),
  ) as typeof given
  return {
    usersSlug: "users",
    cookieName: DEFAULT_COOKIE_NAME,
    payloadUserCookie: DEFAULT_PAYLOAD_USER_COOKIE,
    isPayloadUser: () => true,
    accountPath: "/account",
    sessionSeconds: 60 * 60 * 24 * 7,
    requiredUserColumns: [],
    ...rest,
    enabled: ({ payload }) => isPluginOn(given.enabled, payload),
  }
}

/** Whether the request carries the SSO session cookie at all. */
export function hasSessionCookie(headers: Headers, cookieName: string): boolean {
  return (headers.get("cookie") ?? "")
    .split(";")
    .some((pair) => pair.trim().startsWith(`${cookieName}=`))
}

/**
 * The user a request's Better Auth session belongs to, whoever they are: staff or member.
 * Null without a session, or while single sign-on is off.
 */
export async function sessionUser(
  payload: Payload,
  headers: Headers,
  config: ResolvedSsoConfig,
): Promise<SignedInUser | null> {
  // Most requests have no session: answer them without touching the database.
  if (!hasSessionCookie(headers, config.cookieName)) return null

  try {
    if (!(await config.enabled({ payload }))) return null

    // Never refreshed here: a refresh writes the cookie, and a cookie written during one
    // of the admin's server actions invalidates the router cache, which re-runs the
    // action. The session simply lasts `sessionSeconds` from sign-in.
    const auth = await getAuth(payload, config)
    const session = await auth.api.getSession({ headers, query: { disableRefresh: true } })
    if (!session) return null

    const user = await payload.findByID({
      collection: config.usersSlug as CollectionSlug,
      id: payload.db.defaultIDType === "number" ? Number(session.user.id) : session.user.id,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
    })
    return (user as SignedInUser | null) ?? null
  } catch (err) {
    payload.logger.error({ err }, "[sso] couldn't read the session")
    return null
  }
}

/** `getSignedInUser`, for the plugin's own code, which holds the resolved config. */
export async function signedInUser(
  req: Pick<PayloadRequest, "payload" | "headers" | "user">,
  config: ResolvedSsoConfig,
): Promise<SignedInUser | null> {
  if (req.user && req.user.collection === config.usersSlug)
    return req.user as unknown as SignedInUser
  return sessionUser(req.payload, req.headers, config)
}

/**
 * Who is signed in: Payload's own user (a password login, or staff through a provider), or
 * else the user behind a provider session Payload doesn't accept (a member). For the site's
 * own features, which members use too; Payload's access rules only ever see `req.user`.
 */
export async function getSignedInUser(
  req: Pick<PayloadRequest, "payload" | "headers" | "user">,
  options: SsoPluginConfig,
): Promise<SignedInUser | null> {
  return signedInUser(req, resolveSsoConfig(options))
}
