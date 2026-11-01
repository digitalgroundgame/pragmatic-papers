import type { Crumb } from "@/components/Breadcrumbs"
import { DocsLayout } from "@/components/DocsNav"
import { JsonLd } from "@/components/JsonLd"
import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import type { queryPublishedDocs } from "@/plugins/docs/queries"
import {
  docPaths,
  DOCS_PATH,
  docsTree,
  HOME_DOC_SLUG,
  parentIds,
  WHATS_NEW_PATH,
} from "@/plugins/docs/sections"
import { docThumbnail } from "@/plugins/docs/thumbnail"
import { formatNotificationDate } from "@/plugins/notifications/unread"
import { buildBreadcrumbJsonLd } from "@/utilities/structuredData"
import React from "react"

export type WhatsNewDoc = Awaited<ReturnType<typeof queryPublishedDocs>>[number]

/**
 * /docs/whats-new: every doc, newest first, with its thumbnail and summary, beside the sidebar.
 * Areas and sections are left out: they introduce the docs under them rather than a feature.
 */
export function WhatsNew({ docs }: { docs: WhatsNewDoc[] }): React.ReactNode {
  const tree = docsTree(docs)
  const paths = docPaths(tree)
  const parents = parentIds(tree)
  const latest = docs.filter((doc) => doc.slug !== HOME_DOC_SLUG && !parents.has(String(doc.id)))
  const trail: Crumb[] = [
    { name: "Docs", path: DOCS_PATH },
    { name: "What's new", path: WHATS_NEW_PATH },
  ]

  return (
    <>
      <DocsLayout tree={tree} current={WHATS_NEW_PATH} breadcrumbs={trail}>
        <section aria-labelledby="docs-latest" className="space-y-6">
          <JsonLd data={[buildBreadcrumbJsonLd(trail)]} />
          <header className="space-y-3">
            <h1 id="docs-latest">What&apos;s new</h1>
            <p className="text-muted-foreground max-w-2xl font-sans text-lg leading-snug md:text-xl">
              How to use the Pragmatic Papers admin, newest first.
            </p>
          </header>
          {latest.length === 0 ? (
            <p className="text-muted-foreground font-serif">No docs yet.</p>
          ) : (
            <ul className="border-t">
              {latest.map((doc) => {
                const thumbnail = docThumbnail(doc.heroImage)
                return (
                  <li key={doc.id} className="border-b py-6">
                    <HoverPrefetchLink
                      href={paths.get(doc.slug) ?? `${DOCS_PATH}/${doc.slug}`}
                      className="group flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6"
                    >
                      {thumbnail && (
                        // Decorative: the title beside it says what the doc is about.
                        // eslint-disable-next-line @next/next/no-img-element -- Media's 300px thumbnail, already small
                        <img
                          src={thumbnail.url}
                          alt=""
                          loading="lazy"
                          width={300}
                          height={158}
                          className="aspect-40/21 w-full shrink-0 rounded-sm border object-cover transition-[filter] duration-300 ease-out hover:brightness-[1.02] hover:contrast-[1.16] hover:saturate-[1.16] sm:w-60"
                        />
                      )}
                      <span className="flex flex-col gap-2">
                        <span className="font-sans text-xl leading-tight font-semibold tracking-tight text-balance decoration-2 underline-offset-4 group-focus-visible:underline hover:underline md:text-2xl">
                          {doc.title}
                        </span>
                        <time
                          className="text-brand-text font-serif text-sm font-semibold"
                          dateTime={doc.publishedAt.slice(0, 10)}
                        >
                          {formatNotificationDate(doc.publishedAt)}
                        </time>
                        <span className="text-foreground line-clamp-3 font-serif leading-snug">
                          {doc.summary}
                        </span>
                      </span>
                    </HoverPrefetchLink>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </DocsLayout>
    </>
  )
}
