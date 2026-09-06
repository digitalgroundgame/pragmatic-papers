import { draftMode } from "next/headers"

import { loadInteractiveRegion, queryInteractiveBySlug } from "@/interactives/load"

interface Args {
  params: Promise<{ slug: string; regionId: string }>
}

/**
 * The lazily fetched asset for one drillable region — its child geometry plus the records it
 * owns — composed on the server from the code-owned profile and the published snapshot. The
 * client's `AssetLoader` reads it as JSON; the page emits a prefetch link per region so a
 * crawler that follows same-origin references captures a working archive.
 */
export async function GET(_req: Request, { params }: Args): Promise<Response> {
  const { slug, regionId } = await params
  const interactive = await queryInteractiveBySlug(slug)
  if (!interactive) return Response.json({ error: "not found" }, { status: 404 })
  const asset = await loadInteractiveRegion(interactive, regionId)
  if (!asset) return Response.json({ error: "not found" }, { status: 404 })
  const { isEnabled: draft } = await draftMode()
  return Response.json(asset, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // The composed asset is cached server-side by tag; this only tells the browser and a
      // CDN how long to hold it. Drafts are never held.
      "Cache-Control": draft
        ? "no-store"
        : "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
