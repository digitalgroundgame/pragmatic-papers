import { isPluginEnabled } from "@/globals/Plugins/isPluginEnabled"
import { queryPublishedDocs } from "@/plugins/docs/queries"
import { HOME_DOC_SLUG } from "@/plugins/docs/sections"
import type { Metadata } from "next"
import React from "react"

import { DocView, docMetadata } from "./[...path]/DocView"
import { WhatsNew } from "./whats-new/WhatsNew"

// Rendered per request from the data cache, which saving a doc or a deploy's docs sync refreshes:
// a prerendered copy would keep the docs the build saw.
export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  if (!(await isPluginEnabled("docs"))) return {}
  return (await docMetadata(HOME_DOC_SLUG)) ?? { title: "Docs — Pragmatic Papers" }
}

/** The docs' home: the home doc, or What's new on a site whose docs haven't synced it yet. */
export default async function DocsHomePage(): Promise<React.ReactNode> {
  return <DocView slug={HOME_DOC_SLUG} fallback={<WhatsNew docs={await queryPublishedDocs()} />} />
}
