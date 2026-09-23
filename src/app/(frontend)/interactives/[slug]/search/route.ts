import { draftMode } from "next/headers"

import { loadInteractiveSearchIndex, queryInteractiveBySlug } from "@/interactives/load"

interface Args {
  params: Promise<{ slug: string }>
}

/**
 * The interactive's record search index: one entry per record, composed on the server from the
 * code-owned profile and the published snapshot. The client fetches it once, on the reader's
 * first query, and filters in the browser — a page that is never searched never loads it.
 */
export async function GET(_req: Request, { params }: Args): Promise<Response> {
  const { slug } = await params
  const interactive = await queryInteractiveBySlug(slug)
  if (!interactive) return Response.json({ error: "not found" }, { status: 404 })
  const index = await loadInteractiveSearchIndex(interactive)
  if (!index) return Response.json({ error: "not found" }, { status: 404 })
  const { isEnabled: draft } = await draftMode()
  return Response.json(index, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": draft
        ? "no-store"
        : "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
