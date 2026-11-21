import type { CollectionSlug, PayloadRequest } from "payload"

import { draftMode } from "next/headers"
import { redirect } from "next/navigation"
import { type NextRequest } from "next/server"
import { getPayloadClient } from "@/data/payload"

/** A stand-in for this site's origin, to see where a path leads. */
const SELF = "http://preview.invalid"

/**
 * Whether a browser sent to `path` stays on this site. It goes by where the path resolves,
 * not by how the string starts: to a browser "//host" and "/\\host" are addresses on another
 * site, and it drops tabs and newlines before reading the address, so "/\t/host" is one too.
 */
function staysOnThisSite(path: string): boolean {
  if (!path.startsWith("/") || !URL.canParse(path, SELF)) return false
  return new URL(path, SELF).origin === SELF
}

export async function GET(req: NextRequest): Promise<Response> {
  const payload = await getPayloadClient()

  const path = req.nextUrl.searchParams.get("path")
  const collection = req.nextUrl.searchParams.get("collection") as CollectionSlug
  const slug = req.nextUrl.searchParams.get("slug")
  const previewSecret = req.nextUrl.searchParams.get("previewSecret")

  if (previewSecret !== process.env.PREVIEW_SECRET) {
    return new Response("You are not allowed to preview this page", { status: 403 })
  }

  if (!path || !collection || !slug) {
    return new Response("Insufficient search params", { status: 404 })
  }

  if (!staysOnThisSite(path)) {
    return new Response("This endpoint can only be used for relative previews", { status: 500 })
  }

  let user

  try {
    const authResult = await payload.auth({
      req: req as unknown as PayloadRequest,
      headers: req.headers,
    })
    user = authResult.user
  } catch (error) {
    payload.logger.error({ err: error }, "Error verifying token for live preview")
    return new Response("You are not allowed to preview this page", { status: 403 })
  }

  const draft = await draftMode()

  if (!user) {
    draft.disable()
    return new Response("You are not allowed to preview this page", { status: 403 })
  }

  // You can add additional checks here to see if the user is allowed to preview this page

  draft.enable()

  redirect(path)
}
