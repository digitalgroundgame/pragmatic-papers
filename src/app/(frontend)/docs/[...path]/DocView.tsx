import { EndRule } from "@/blocks/SquiggleRule/EndRule"
import { ArticleSidebar } from "@/components/ArticleSidebar"
import type { Crumb } from "@/components/Breadcrumbs"
import { DocPager, DocsLayout } from "@/components/DocsNav"
import { JsonLd } from "@/components/JsonLd"
import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
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
import { queryDocBySlug, queryPublishedDocs } from "@/plugins/docs/queries"
import {
  adjacentDocs,
  docLineage,
  docNavTitle,
  docPaths,
  docsTree,
  DOCS_PATH,
  HOME_DOC_SLUG,
} from "@/plugins/docs/sections"
import { findTour, tourHref } from "@/plugins/tours"
import { getMediaUrl } from "@/utilities/getMediaUrl"
import { getSiteURL } from "@/utilities/getURL"
import { mergeOpenGraph } from "@/utilities/mergeOpenGraph"
import { buildBreadcrumbJsonLd } from "@/utilities/structuredData"
import type { Metadata } from "next"
import { draftMode } from "next/headers"
import { notFound, redirect } from "next/navigation"
import React from "react"

import { DocDates } from "./DocDates"

type PublishedDoc = Awaited<ReturnType<typeof queryPublishedDocs>>[number]
type ViewedDoc = NonNullable<Awaited<ReturnType<typeof queryDocBySlug>>>

/**
 * Where a doc is read: its place in the published tree, or, for a draft no published doc leads
 * to yet, the address its own breadcrumbs give it.
 */
const pathOf = (doc: ViewedDoc, paths: Map<string, string>): string =>
  paths.get(doc.slug) ?? doc.breadcrumbs?.at(-1)?.url ?? `${DOCS_PATH}/${doc.slug}`

/** A doc's title, summary, canonical URL and hero image for search and link previews. */
export async function docMetadata(slug: string): Promise<Metadata | null> {
  if (!(await isPluginEnabled("docs"))) return null
  const [doc, docs] = await Promise.all([queryDocBySlug(slug), queryPublishedDocs()])
  if (!doc) return null

  const title = `${doc.title} — Pragmatic Papers`
  const canonicalUrl = `${getSiteURL()}${pathOf(doc, docPaths(docsTree(docs)))}`
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
  /** The address asked for; a doc asked for anywhere but its place in the tree is sent there. */
  requestedPath?: string
  /** Shown when there's no such doc; the redirects otherwise. */
  fallback?: React.ReactNode
}

/** The docs under one, each with its summary, at the foot of an area's or section's page. */
function ChildDocs({ docs }: { docs: { doc: PublishedDoc; path: string }[] }): React.ReactNode {
  if (!docs.length) return null
  return (
    <section aria-labelledby="docs-children" className="max-w-2xl space-y-3">
      <h2 id="docs-children">In this section</h2>
      <ul className="border-t font-sans">
        {docs.map(({ doc, path }) => (
          <li key={doc.id} className="border-b py-4">
            <HoverPrefetchLink
              href={path}
              className="group flex flex-col gap-1 no-underline underline-offset-4"
            >
              <span className="text-foreground text-lg font-bold group-hover:underline">
                {docNavTitle(doc)}
              </span>
              <span className="text-muted-foreground font-serif leading-snug">{doc.summary}</span>
            </HoverPrefetchLink>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * A doc beside the docs' sidebar, in the article page's type, so it reads like an article in a
 * wiki: at its place in the tree, `/docs/<area>/<section>/<slug>`, and the home doc at /docs.
 */
export async function DocView({
  slug,
  requestedPath,
  fallback,
}: DocViewProps): Promise<React.ReactNode> {
  if (!(await isPluginEnabled("docs"))) notFound()
  const { isEnabled: draft } = await draftMode()
  const [doc, docs] = await Promise.all([queryDocBySlug(slug), queryPublishedDocs()])
  const tree = docsTree(docs)
  const paths = docPaths(tree)
  if (!doc) return fallback ?? <PayloadRedirects url={requestedPath ?? `${DOCS_PATH}/${slug}`} />

  const url = pathOf(doc, paths)
  // The route finds a doc by its slug alone, so any other path to it (one from before an editor
  // moved it) goes to where it is now. Not permanent, since editors can move it back. A draft
  // preview stays where it was opened.
  if (requestedPath && requestedPath !== url && !draft) redirect(url)

  // Docs saved in the admin are stamped on save; stamping here too covers any synced before the
  // field existed, and is a no-op on content that already has its anchors.
  const content = stampTableOfContentsAnchors(doc.content)
  const showTableOfContents =
    doc.showTableOfContents !== false && (await isExperimentEnabled("tableOfContents"))

  const tour = (await isPluginEnabled("tours")) ? findTour(doc.tour) : undefined
  const lineage = docLineage(tree, slug)
  // A draft no published doc leads to yet has only its own breadcrumbs.
  const ancestors: Crumb[] = lineage.length
    ? lineage.map((node) => ({ name: node.doc.title, path: node.path }))
    : slug === HOME_DOC_SLUG
      ? []
      : (doc.breadcrumbs ?? []).flatMap((crumb) =>
          crumb.label && crumb.url ? [{ name: crumb.label, path: crumb.url }] : [],
        )
  const trail: Crumb[] = [{ name: "Docs", path: DOCS_PATH }, ...ancestors]
  const { previous, next } = adjacentDocs(
    tree,
    slug,
    docs.find((item) => item.slug === HOME_DOC_SLUG),
  )
  const pagerDoc = (item?: PublishedDoc) =>
    item && { ...item, href: paths.get(item.slug) ?? `${DOCS_PATH}/${item.slug}` }

  return (
    <DocsLayout tree={tree} current={slug} breadcrumbs={trail}>
      <article className="@container min-w-0 space-y-6">
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
            className="@min-[58rem]:toc-open:gap-10 relative flex flex-col justify-between gap-3 @min-[58rem]:flex-row @min-[58rem]:gap-6"
          >
            {showTableOfContents && (
              // Always shown, with no toggle: to the doc's right whenever its column has room for
              // both (a container query, since the docs' sidebar takes a share of the screen at
              // some widths and not others), and otherwise above it, flush with its text rather
              // than centered as an article's is. No heading: the nav's label names it for
              // screen readers.
              <ArticleSidebar className="toc-open:mx-0 lg:static @min-[58rem]:sticky @min-[58rem]:top-[calc(var(--sticky-top)+1rem)] @min-[58rem]:order-last @min-[58rem]:max-w-56">
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
        <ChildDocs docs={lineage.at(-1)?.children ?? []} />
        <footer className="max-w-2xl space-y-6">
          <DocPager previous={pagerDoc(previous)} next={pagerDoc(next)} />
        </footer>
      </article>
    </DocsLayout>
  )
}
