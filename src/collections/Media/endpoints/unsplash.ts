import type { PayloadRequest } from "payload"

import { isStaff } from "@/access/roles"
import { integrationStatus, unsplash } from "@/integrations"
import type { UnsplashOrientation } from "@/integrations/unsplash"

/**
 * Widest file brought in from Unsplash. Above Media's largest size (xlarge, 1920) so every
 * size is a downscale, without saving a 6000-pixel original nobody renders.
 */
export const UNSPLASH_IMPORT_WIDTH = 2400

const ORIENTATIONS: readonly UnsplashOrientation[] = ["landscape", "portrait", "squarish"]

/** Unsplash ids are short URL-safe strings; anything else never reaches their API. */
const PHOTO_ID = /^[A-Za-z0-9_-]{1,64}$/

/** Staff only, like uploading itself, and only when the key is set. */
function refuse(req: PayloadRequest): Response | null {
  if (!req.user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (!isStaff(req.user)) return Response.json({ error: "Forbidden" }, { status: 403 })
  if (!integrationStatus(unsplash).configured) {
    return Response.json({ error: "Unsplash isn't set up on this site." }, { status: 503 })
  }
  return null
}

function failed(req: PayloadRequest, err: unknown, what: string): Response {
  req.payload.logger.warn({ err }, `Unsplash ${what} failed`)
  return Response.json(
    { error: `Unsplash ${what} failed. Try again in a moment.` },
    { status: 502 },
  )
}

/** GET /api/media/unsplash/search?query=&page=&orientation= */
export async function unsplashSearchHandler(req: PayloadRequest): Promise<Response> {
  const refused = refuse(req)
  if (refused) return refused

  const query = String(req.query?.query ?? "").trim()
  if (!query) return Response.json({ error: "Search for something." }, { status: 400 })
  const page = Math.max(1, Math.min(100, parseInt(String(req.query?.page ?? "1"), 10) || 1))
  const orientation = ORIENTATIONS.find((o) => o === req.query?.orientation)

  try {
    const results = await unsplash.search({ query: query.slice(0, 200), page, orientation })
    return Response.json({ ...results, homeUrl: unsplash.homeUrl() })
  } catch (err) {
    return failed(req, err, "search")
  }
}

/**
 * GET /api/media/unsplash/:photoId/file — the photo's file, for the upload form to save. Fetched
 * here rather than in the browser so the URL is always Unsplash's own, looked up by id.
 * Doesn't count a download: that happens when the media is saved (`attributeUnsplashPhoto`).
 */
export async function unsplashFileHandler(req: PayloadRequest): Promise<Response> {
  const refused = refuse(req)
  if (refused) return refused

  const photoId = String(req.routeParams?.photoId ?? "")
  if (!PHOTO_ID.test(photoId)) return Response.json({ error: "Invalid photo" }, { status: 400 })

  try {
    const photo = await unsplash.photo(photoId)
    const image = await unsplash.image(photo, UNSPLASH_IMPORT_WIDTH)
    return new Response(image.body, {
      headers: {
        "Content-Type": image.headers.get("Content-Type") ?? "image/jpeg",
        "Cache-Control": "private, no-store",
      },
    })
  } catch (err) {
    return failed(req, err, "download")
  }
}
