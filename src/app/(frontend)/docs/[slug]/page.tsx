import { HOME_DOC_SLUG } from "@/plugins/docs/sections"
import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"
import React from "react"

import { DocView, docMetadata } from "./DocView"

interface Args {
  params: Promise<{ slug: string }>
}

// Rendered per request from the data cache, which saving a doc or a deploy's docs sync refreshes:
// a prerendered copy would keep the doc the build saw.
export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  return (await docMetadata(slug)) ?? {}
}

export default async function DocPage({ params }: Args): Promise<React.ReactNode> {
  const { slug } = await params
  // The home doc lives at /docs.
  if (slug === HOME_DOC_SLUG) permanentRedirect("/docs")
  return <DocView slug={slug} />
}
