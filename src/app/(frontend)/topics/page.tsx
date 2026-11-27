import type { Metadata } from "next"
import { draftMode } from "next/headers"
import React from "react"

import { hasPanels, RenderPanels } from "@/blocks/Panel/Component"
import { RenderBlocks } from "@/blocks/RenderBlocks"
import { WithAside } from "@/components/Aside"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { LivePreviewListener } from "@/components/LivePreviewListener"
import { PageShell } from "@/components/PageShell"
import { SitePageHeader } from "@/components/PageShell/SitePageHeader"
import {
  TOPICS_ASIDE,
  TOPICS_DESCRIPTION,
  TOPICS_TITLE,
  topicsPage,
} from "@/collections/Pages/starterPages/topics"
import { querySitePage } from "@/data/queries"
import { generateMeta, paginatedPath } from "@/utilities/generateMeta"

interface Args {
  searchParams: Promise<{
    p?: string
  }>
}

export async function generateMetadata({ searchParams }: Args): Promise<Metadata> {
  const { p } = await searchParams
  const page = await querySitePage("topics")
  return generateMeta({ doc: page ?? topicsPage, canonicalPath: paginatedPath("/topics", p) })
}

/**
 * Every topic. The list is the site's (the Topics list block); the title, introduction and
 * aside are the Topics site page's, which editors own. Until that page is published, the
 * route shows what it did as code, so a deploy that creates the draft changes nothing.
 */
export default async function TopicsPage({ searchParams }: Args): Promise<React.ReactNode> {
  const { isEnabled: draft } = await draftMode()
  const { p } = await searchParams
  let pageNumber = Number(p) || 1
  if (!Number.isInteger(pageNumber) || pageNumber < 1) pageNumber = 1

  const page = await querySitePage("topics")
  const layout = page?.layout?.length ? page.layout : topicsPage.layout
  const aside = page ? page.aside : TOPICS_ASIDE

  return (
    <>
      <Breadcrumbs shell items={[{ name: page?.title ?? TOPICS_TITLE, path: "/topics" }]} />
      <PageShell as="div">
        {draft && <LivePreviewListener />}

        <SitePageHeader
          hero={page?.hero}
          title={page?.title ?? TOPICS_TITLE}
          description={TOPICS_DESCRIPTION}
        />

        <WithAside aside={hasPanels(aside) ? <RenderPanels panels={aside} /> : null}>
          <RenderBlocks blocks={layout} pageNumber={pageNumber} paginated />
        </WithAside>
      </PageShell>
    </>
  )
}
