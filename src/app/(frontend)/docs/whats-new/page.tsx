import { isPluginEnabled } from "@/globals/Plugins/isPluginEnabled"
import { queryPublishedDocs } from "@/plugins/docs/queries"
import { WHATS_NEW_PATH } from "@/plugins/docs/sections"
import { getSiteURL } from "@/utilities/getURL"
import { mergeOpenGraph } from "@/utilities/mergeOpenGraph"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import React from "react"

import { WhatsNew } from "./WhatsNew"

const TITLE = "What's new — Pragmatic Papers docs"
const DESCRIPTION = "Every Pragmatic Papers doc, newest first."

// Rendered per request from the data cache, which saving a doc or a deploy's docs sync refreshes:
// a prerendered copy would keep the docs the build saw.
export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  if (!(await isPluginEnabled("docs"))) return {}
  const canonicalUrl = `${getSiteURL()}${WHATS_NEW_PATH}`
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: canonicalUrl },
    openGraph: mergeOpenGraph({ title: TITLE, description: DESCRIPTION, url: canonicalUrl }),
  }
}

export default async function WhatsNewPage(): Promise<React.ReactNode> {
  if (!(await isPluginEnabled("docs"))) notFound()
  return <WhatsNew docs={await queryPublishedDocs()} />
}
