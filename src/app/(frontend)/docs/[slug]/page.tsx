import { EndRule } from "@/blocks/SquiggleRule/EndRule"
import { ArticleSidebar } from "@/components/ArticleSidebar"
import { Breadcrumbs, type Crumb } from "@/components/Breadcrumbs"
import { DocsLayout } from "@/components/DocsNav"
import { JsonLd } from "@/components/JsonLd"
import { LivePreviewListener } from "@/components/LivePreviewListener"
import { PayloadRedirects } from "@/components/PayloadRedirects"
import RichText from "@/components/RichText"
import {
  TableOfContents,
  TableOfContentsButton,
  TableOfContentsProvider,
  stampTableOfContentsAnchors,
} from "@/components/TableOfContents"
import { ShareButtons } from "@/components/ShareButtons"
import { Separator } from "@/components/ui/separator"
import { isExperimentEnabled } from "@/globals/SiteSettings/isExperimentEnabled"
import { queryDocBySlug, queryPublishedDocs } from "@/plugins/docs/queries"
import { groupDocsBySection } from "@/plugins/docs/sections"
import { formatNotificationDate } from "@/plugins/notifications/unread"
import { getMediaUrl } from "@/utilities/getMediaUrl"
import { getServerSideURL } from "@/utilities/getURL"
import { mergeOpenGraph } from "@/utilities/mergeOpenGraph"
import { buildBreadcrumbJsonLd } from "@/utilities/structuredData"
import type { Metadata } from "next"
import { draftMode } from "next/headers"
import React from "react"

interface Args {
  params: Promise<{ slug: string }>
}

// Rendered per request from the data cache, which saving a doc or a deploy's docs sync refreshes:
// a prerendered copy would keep the doc the build saw.
export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  const doc = await queryDocBySlug(slug)
  if (!doc) return {}

  const title = `${doc.title} — Pragmatic Papers`
  const canonicalUrl = `${getServerSideURL()}/docs/${slug}`
  const ogImage =
    typeof doc.heroImage === "object" ? getMediaUrl(doc.heroImage?.sizes?.og?.url) : undefined
  return {
    title,
    description: doc.summary,
    alternates: { canonical: canonicalUrl },
    openGraph: mergeOpenGraph({
      title,
      description: doc.summary,
      url: canonicalUrl,
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    }),
  }
}

export default async function DocPage({ params }: Args): Promise<React.ReactNode> {
  const { isEnabled: draft } = await draftMode()
  const { slug } = await params
  const url = `/docs/${slug}`
  const [doc, docs] = await Promise.all([queryDocBySlug(slug), queryPublishedDocs()])
  if (!doc) return <PayloadRedirects url={url} />

  // Docs saved in the admin are stamped on save; stamping here too covers any synced before the
  // field existed, and is a no-op on content that already has its anchors.
  const content = stampTableOfContentsAnchors(doc.content)
  const showTableOfContents =
    doc.showTableOfContents !== false && (await isExperimentEnabled("tableOfContents"))

  const trail: Crumb[] = [
    { name: "Docs", path: "/docs" },
    { name: doc.title, path: url },
  ]

  // The article page's type beside the docs' sidebar, so a doc reads like an article in a wiki.
  return (
    <>
      <Breadcrumbs items={trail} className="max-w-7xl" />
      <DocsLayout sections={groupDocsBySection(docs)} current={slug}>
        <article className="min-w-0 space-y-6">
          <JsonLd data={[buildBreadcrumbJsonLd(trail)]} />
          {draft && <LivePreviewListener />}
          <TableOfContentsProvider>
            <header className="flex flex-col gap-2">
              <h1 className="mt-3">{doc.title}</h1>
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* The article dateline's shape, by day: a doc's dates carry no time. */}
                <p className="text-foreground font-serif">
                  <time dateTime={doc.publishedAt.slice(0, 10)}>
                    {formatNotificationDate(doc.publishedAt)}
                  </time>
                  {doc.revisedAt && (
                    <time
                      className="text-muted-foreground ml-2"
                      dateTime={doc.revisedAt.slice(0, 10)}
                    >
                      Updated {formatNotificationDate(doc.revisedAt)}
                    </time>
                  )}
                </p>
                <div className="flex items-center gap-1">
                  {showTableOfContents && <TableOfContentsButton content={content} />}
                  <ShareButtons url={`${getServerSideURL()}${url}`} title={doc.title} />
                </div>
              </div>
              <Separator />
            </header>
            <div
              id="intro"
              className="xl:toc-open:gap-10 relative flex flex-col justify-between gap-3 xl:flex-row xl:gap-6"
            >
              {showTableOfContents && (
                // Beside the doc only from xl, where the docs' sidebar leaves room for both.
                <ArticleSidebar className="lg:static xl:sticky xl:top-[calc(var(--sticky-top)+1rem)] xl:max-w-56">
                  <TableOfContents content={content} />
                </ArticleSidebar>
              )}
              <div className="mx-auto max-w-2xl">
                <RichText data={content} enableGutter={false} className="drop-cap" />
                <EndRule content={content} />
              </div>
            </div>
          </TableOfContentsProvider>
        </article>
      </DocsLayout>
    </>
  )
}
