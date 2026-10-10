import { EndRule } from "@/blocks/SquiggleRule/EndRule"
import { ArticleSidebar } from "@/components/ArticleSidebar"
import { Breadcrumbs, type Crumb } from "@/components/Breadcrumbs"
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
import { queryDocBySlug } from "@/plugins/docs/queries"
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
  const doc = await queryDocBySlug(slug)
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

  // The article page's layout and type, so a doc reads like one.
  return (
    <>
      {/* As wide as the header below it: container's padding matches the article's px-4. */}
      <Breadcrumbs items={trail} className="max-w-5xl" />
      <article className="mx-auto max-w-5xl min-w-0 space-y-6 px-4 pb-16">
        <JsonLd data={[buildBreadcrumbJsonLd(trail)]} />
        {draft && <LivePreviewListener />}
        <TableOfContentsProvider>
          <header className="flex flex-col gap-2">
            <h1 className="mt-3">{doc.title}</h1>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <time className="text-foreground font-serif" dateTime={doc.publishedAt.slice(0, 10)}>
                {formatNotificationDate(doc.publishedAt)}
              </time>
              <div className="flex items-center gap-1">
                {showTableOfContents && <TableOfContentsButton content={content} />}
                <ShareButtons url={`${getServerSideURL()}${url}`} title={doc.title} />
              </div>
            </div>
            <Separator />
          </header>
          <div
            id="intro"
            className="lg:toc-open:gap-10 xl:toc-open:gap-20 relative flex flex-col justify-between gap-3 lg:flex-row lg:gap-6"
          >
            {showTableOfContents && (
              <ArticleSidebar>
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
    </>
  )
}
