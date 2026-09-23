import {
  loadInteractiveGeometry,
  loadInteractiveGeometryHash,
  queryInteractiveBySlug,
} from "@/interactives/load"

interface Args {
  params: Promise<{ slug: string; regionId: string; hash: string }>
}

/**
 * One region's shapes, and nothing that changes with the data.
 *
 * The `hash` segment is a content hash of the geometry, put in the URL by the page so that a
 * reprojection issues a different URL. That is what lets this be cached forever — a map held
 * past its own change is a map nobody can clear, so the URL has to move when the map does
 * rather than the cache having to be short. Which only holds if the segment is actually
 * checked: an old URL naming a since-reprojected map, or any other value, must not be served
 * `immutable` — that would hand out a year-long cache lifetime for content the URL disagrees
 * with, or for as many distinct URLs as a caller cares to mint.
 *
 * Serving it apart from the records is the point of the split: the records change every time
 * the sync finds something, and used to drag a map that had not moved along with them.
 */
/** Never `immutable`: a stale or malformed hash must not be remembered as gone forever. */
const NOT_FOUND_HEADERS = { "Cache-Control": "public, max-age=0, must-revalidate" }

export async function GET(_req: Request, { params }: Args): Promise<Response> {
  const { slug, regionId, hash } = await params
  const interactive = await queryInteractiveBySlug(slug)
  if (!interactive)
    return Response.json({ error: "not found" }, { status: 404, headers: NOT_FOUND_HEADERS })
  const current = await loadInteractiveGeometryHash(interactive, regionId)
  if (current === null || current !== hash)
    return Response.json({ error: "not found" }, { status: 404, headers: NOT_FOUND_HEADERS })
  const geometry = await loadInteractiveGeometry(interactive, regionId)
  if (!geometry)
    return Response.json({ error: "not found" }, { status: 404, headers: NOT_FOUND_HEADERS })
  return Response.json(geometry, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
