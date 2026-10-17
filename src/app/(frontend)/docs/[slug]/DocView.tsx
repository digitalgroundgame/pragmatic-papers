import { EndRule } from "@/blocks/SquiggleRule/EndRule"
import { ArticleSidebar } from "@/components/ArticleSidebar"
import type { Crumb } from "@/components/Breadcrumbs"
import { DocPager, DocsLayout } from "@/components/DocsNav"
import { JsonLd } from "@/components/JsonLd"
import { LivePreviewListener } from "@/components/LivePreviewListener"
import { Media } from "@/components/Media"
import { PayloadRedirects } from "@/components/PayloadRedirects"
import RichText from "@/components/RichText"
import {
  TableOfContents,
  TableOfContentsProvider,
  stampTableOfContentsAnchors,
} from "@/components/TableOfContents"
import { ShareButtons } from "@/components/ShareButtons"
import { LinkButton } from "@/components/ui/link-button"
import { Separator } from "@/components/ui/separator"
import { isPluginEnabled } from "@/globals/Plugins/isPluginEnabled"
import { isExperimentEnabled } from "@/globals/SiteSettings/isExperimentEnabled"
import { queryDocBySlug, queryDocSections, queryPublishedDocs } from "@/plugins/docs/queries"
import { adjacentDocs, docPath, groupDocs, HOME_DOC_SLUG } from "@/plugins/docs/sections"
import { findTour, tourHref } from "@/plugins/tours"
import { getMediaUrl } from "@/utilities/getMediaUrl"
import { getSiteURL } from "@/utilities/getURL"
import { mergeOpenGraph } from "@/utilities/mergeOpenGraph"
import { buildBreadcrumbJsonLd } from "@/utilities/structuredData"
import type { Metadata } from "next"
import { draftMode } from "next/headers"
import { notFound } from "next/navigation"
import React from "react"

import { DocDates } from "./DocDates"

/** A doc's title, summary, canonical URL and hero image for search and link previews. */
export async function docMetadata(slug: string): Promise<Metadata | null> {
  if (!(await isPluginEnabled("docs"))) return null
  const doc = await queryDocBySlug(slug)
  if (!doc) return null

  const title = `${doc.title} — Pragmatic Papers`
  const canonicalUrl = `${getSiteURL()}${docPath(slug)}`
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

interface DocViewProps {
  slug: string
  /** Shown when there's no such doc; the redirects otherwise. */
  fallback?: React.ReactNode
}

/**
 * A doc beside the docs' sidebar, in the article page's type, so it reads like an article in a
 * wiki: /docs/<slug>, and the home doc at /docs.
 */
export async function DocView({ slug, fallback }: DocViewProps): Promise<React.ReactNode> {
  if (!(await isPluginEnabled("docs"))) notFound()
  const { isEnabled: draft } = await draftMode()
  const url = docPath(slug)
  const [doc, docs, sectionNodes] = await Promise.all([
    queryDocBySlug(slug),
    queryPublishedDocs(),
    queryDocSections(),
  ])
  if (!doc) return fallback ?? <PayloadRedirects url={url} />

  // Docs saved in the admin are stamped on save; stamping here too covers any synced before the
  // field existed, and is a no-op on content that already has its anchors.
  const content = stampTableOfContentsAnchors(doc.content)
  const showTableOfContents =
    doc.showTableOfContents !== false && (await isExperimentEnabled("tableOfContents"))

  const tour = (await isPluginEnabled("tours")) ? findTour(doc.tour) : undefined
  const home = slug === HOME_DOC_SLUG
  const trail: Crumb[] = [
    { name: "Docs", path: "/docs" },
    ...(home ? [] : [{ name: doc.title, path: url }]),
  ]
  const areas = groupDocs(docs, sectionNodes)
  const { previous, next } = adjacentDocs(
    areas,
    slug,
    docs.find((item) => item.slug === HOME_DOC_SLUG),
  )

  return (
    <DocsLayout areas={areas} current={slug} breadcrumbs={trail}>
      <article className="min-w-0 space-y-6">
        <JsonLd data={[buildBreadcrumbJsonLd(trail)]} />
        {draft && <LivePreviewListener />}
        <TableOfContentsProvider>
          <header className="flex flex-col gap-2">
            {doc.heroImage && (
              <Media
                priority
                sizes="(max-width: 1024px) 100vw, 900px"
                media={doc.heroImage}
                variant="large"
                className="border shadow"
              />
            )}
            <h1 className="mt-3">{doc.title}</h1>
            {/* The dek: the summary the bell and link previews show. */}
            <p className="text-muted-foreground font-sans text-lg leading-snug text-pretty md:text-xl">
              {doc.summary}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <DocDates publishedAt={doc.publishedAt} revisedAt={doc.revisedAt} />
              <div className="flex items-center gap-1">
                {tour && (
                  // Starts the tour in the admin, which asks a reader who isn't signed in to.
                  <LinkButton size="sm" className="mr-2" href={tourHref(tour.key)}>
                    Show me
                  </LinkButton>
                )}
                <ShareButtons url={`${getSiteURL()}${url}`} title={doc.title} />
              </div>
            </div>
            <Separator />
          </header>
          <div
            id="intro"
            className="xl:toc-open:gap-10 relative flex flex-col justify-between gap-3 xl:flex-row xl:gap-6"
          >
            {showTableOfContents && (
              // Always shown, with no toggle: above the doc on narrow screens, and to its right
              // from xl, where the docs' sidebar leaves room for both. No heading: the nav's
              // label names it for screen readers.
              <ArticleSidebar className="lg:static xl:sticky xl:top-[calc(var(--sticky-top)+1rem)] xl:order-last xl:max-w-56">
                <TableOfContents content={content} title="" />
              </ArticleSidebar>
            )}
            <div className="max-w-2xl">
              <RichText
                data={content}
                enableGutter={false}
                // The separator above already sets the doc off from its header.
                className="drop-cap [&>:first-child]:mt-0"
              />
              <EndRule content={content} />
            </div>
          </div>
        </TableOfContentsProvider>
        <footer className="max-w-2xl space-y-6">
          <DocPager previous={previous} next={next} />
        </footer>
      </article>
    </DocsLayout>
  )
}
