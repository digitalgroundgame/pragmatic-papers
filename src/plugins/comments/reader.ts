import type { CollectionSlug, PayloadRequest } from "payload"

import { getReaderAuth } from "./auth"
import { READERS_SLUG } from "./constants"
import type { ResolvedCommentsConfig } from "./types"

export interface Reader {
  id: number | string
  name: string
  avatarUrl?: string | null
  banned?: boolean | null
}

/** Whether the request carries the reader's session cookie at all. */
export function hasReaderCookie(headers: Headers, cookieName: string): boolean {
  return (headers.get("cookie") ?? "")
    .split(";")
    .some((pair) => pair.trim().startsWith(`${cookieName}=`))
}

/** The reader the request's session belongs to, or null. */
export async function currentReader(
  req: PayloadRequest,
  config: ResolvedCommentsConfig,
): Promise<Reader | null> {
  // Most readers never sign in: answer them without touching the database.
  if (!hasReaderCookie(req.headers, config.cookieName)) return null

  try {
    const auth = await getReaderAuth(req.payload, config)
    const session = await auth.api.getSession({
      headers: req.headers,
      query: { disableRefresh: true },
    })
    if (!session) return null

    const reader = await req.payload.findByID({
      collection: READERS_SLUG as CollectionSlug,
      id: req.payload.db.defaultIDType === "number" ? Number(session.user.id) : session.user.id,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      req,
    })
    return (reader as Reader | null) ?? null
  } catch (err) {
    req.payload.logger.error({ err }, "[comments] couldn't read the reader's session")
    return null
  }
}
