import { queryPublishedDocs } from "@/plugins/docs/queries"
import { getServerSideURL } from "@/utilities/getURL"
import { mergeOpenGraph } from "@/utilities/mergeOpenGraph"
import type { Metadata } from "next"
import React from "react"

import { DocsIndex } from "./DocsIndex"

const TITLE = "Docs — Pragmatic Papers"
const DESCRIPTION = "What's new in the Pragmatic Papers admin, and how to use it."

// Rendered per request from the data cache, which saving a doc or a deploy's docs sync refreshes:
// a prerendered copy would keep the docs the build saw.
export const dynamic = "force-dynamic"

export function generateMetadata(): Metadata {
  const canonicalUrl = `${getServerSideURL()}/docs`
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: canonicalUrl },
    openGraph: mergeOpenGraph({ title: TITLE, description: DESCRIPTION, url: canonicalUrl }),
  }
}

export default async function DocsIndexPage(): Promise<React.ReactNode> {
  return <DocsIndex docs={await queryPublishedDocs()} />
}
