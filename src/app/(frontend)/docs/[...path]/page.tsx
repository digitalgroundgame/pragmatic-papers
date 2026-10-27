import { HOME_DOC_SLUG } from "@/plugins/docs/sections"
import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import React from "react"

import { DocView, docMetadata } from "./DocView"

interface Args {
  params: Promise<{ path: string[] }>
}

// Rendered per request from the data cache, which saving a doc or a deploy's docs sync refreshes:
// a prerendered copy would keep the doc the build saw.
export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const slug = (await params).path.at(-1)
  return (slug && (await docMetadata(slug))) || {}
}

/**
 * A doc at its place in the tree, `/docs/<area>/<section>/<slug>`. Slugs are unique across the
 * docs, so the last segment names the doc and the rest only has to match where it sits now.
 */
export default async function DocPage({ params }: Args): Promise<React.ReactNode> {
  const { path } = await params
  const slug = path.at(-1)
  if (!slug) notFound()
  // The home doc lives at /docs.
  if (path.length === 1 && slug === HOME_DOC_SLUG) permanentRedirect("/docs")
  return <DocView slug={slug} requestedPath={`/docs/${path.join("/")}`} />
}
