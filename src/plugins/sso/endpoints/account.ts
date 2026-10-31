import type { CollectionSlug, Endpoint, PayloadHandler, PayloadRequest } from "payload"

import { ACCOUNT_ENDPOINT_PATH } from "../constants"
import { isPlaceholderEmail } from "../placeholderEmail"
import { signedInUser } from "../session"
import type { ResolvedSsoConfig } from "../types"

/** The longest display name, in characters. */
export const MAX_NAME_LENGTH = 60

const notFound = () => Response.json({ message: "Not Found" }, { status: 404 })
const unauthorized = () => Response.json({ message: "Sign in first." }, { status: 401 })

/** What the account page shows about the signed-in user. */
export interface AccountSummary {
  name: string
  /** Null for a member with only a placeholder (they signed up with Destiny.gg). */
  email: string | null
  /** Their account is managed in the admin, where staff also delete it. */
  managedInAdmin: boolean
}

/** Whether a cross-site page sent this. A browser always names the page's origin on a write. */
function isCrossSite(req: PayloadRequest, config: ResolvedSsoConfig): boolean {
  const origin = req.headers.get("origin")
  return !origin || origin !== new URL(config.baseURL()).origin
}

/** A display name as typed, tidied, or why it can't be saved. */
export function normalizeName(
  raw: unknown,
): { ok: true; name: string } | { ok: false; message: string } {
  if (typeof raw !== "string") return { ok: false, message: "Enter a name." }
  const name = raw
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  if (!name) return { ok: false, message: "Enter a name." }
  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, message: `Names can be at most ${MAX_NAME_LENGTH} characters.` }
  }
  return { ok: true, name }
}

/**
 * The site's account page for whoever is signed in, members included (Payload doesn't know
 * them, so its own `/api/users/me` can't): read it, change the display name, and, for members,
 * delete the account. Staff manage theirs in the admin.
 */
export function accountEndpoints(config: ResolvedSsoConfig): Endpoint[] {
  async function signedIn(req: PayloadRequest) {
    if (!(await config.enabled({ payload: req.payload }))) return notFound()
    return (await signedInUser(req, config)) ?? unauthorized()
  }

  const summary = (user: Record<string, unknown>): AccountSummary => ({
    name: typeof user.name === "string" ? user.name : "",
    email: typeof user.email === "string" && !isPlaceholderEmail(user.email) ? user.email : null,
    managedInAdmin: config.isPayloadUser(user),
  })

  const get: PayloadHandler = async (req) => {
    const user = await signedIn(req)
    if (user instanceof Response) return user
    return Response.json(summary(user))
  }

  const patch: PayloadHandler = async (req) => {
    const user = await signedIn(req)
    if (user instanceof Response) return user
    if (isCrossSite(req, config)) return Response.json({ message: "Forbidden" }, { status: 403 })

    const json = (await req.json?.().catch(() => null)) as { name?: unknown } | null
    const name = normalizeName(json?.name)
    if (!name.ok) return Response.json({ message: name.message }, { status: 400 })

    const updated = await req.payload.update({
      collection: config.usersSlug as CollectionSlug,
      id: user.id,
      data: { name: name.name } as never,
      overrideAccess: true,
      req,
    })
    return Response.json(summary(updated as unknown as Record<string, unknown>))
  }

  const remove: PayloadHandler = async (req) => {
    const user = await signedIn(req)
    if (user instanceof Response) return user
    if (isCrossSite(req, config)) return Response.json({ message: "Forbidden" }, { status: 403 })
    if (config.isPayloadUser(user)) {
      return Response.json({ message: "Staff accounts are deleted by an admin." }, { status: 403 })
    }

    // Its sessions and linked sign-ins go with it (their foreign keys cascade).
    await req.payload.delete({
      collection: config.usersSlug as CollectionSlug,
      id: user.id,
      overrideAccess: true,
      req,
    })

    const secure = config.baseURL().startsWith("https://")
    const headers = new Headers()
    for (const name of [config.cookieName, config.payloadUserCookie]) {
      headers.append(
        "Set-Cookie",
        `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`,
      )
    }
    return Response.json({ ok: true }, { headers })
  }

  return [
    { path: ACCOUNT_ENDPOINT_PATH, method: "get", handler: get },
    { path: ACCOUNT_ENDPOINT_PATH, method: "patch", handler: patch },
    { path: ACCOUNT_ENDPOINT_PATH, method: "delete", handler: remove },
  ]
}
