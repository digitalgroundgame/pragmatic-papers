import type { Crumb } from "@/components/Breadcrumbs"
import { DocsLayout } from "@/components/DocsNav"
import { JsonLd } from "@/components/JsonLd"
import { docThumbnail } from "@/plugins/docs/thumbnail"
import type { queryDocSections, queryPublishedDocs } from "@/plugins/docs/queries"
import { groupDocs, HOME_DOC_SLUG, WHATS_NEW_PATH } from "@/plugins/docs/sections"
import { formatNotificationDate } from "@/plugins/notifications/unread"
import { buildBreadcrumbJsonLd } from "@/utilities/structuredData"
import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import React from "react"

export type WhatsNewDoc = Awaited<ReturnType<typeof queryPublishedDocs>>[number]
export type WhatsNewSection = Awaited<ReturnType<typeof queryDocSections>>[number]

/** /docs/whats-new: every doc, newest first, with its thumbnail and summary, beside the sidebar. */
export function WhatsNew({
  docs,
  sections,
}: {
  docs: WhatsNewDoc[]
  /** The sidebar's areas and sections (`queryDocSections`). */
  sections: WhatsNewSection[]
}): React.ReactNode {
  const areas = groupDocs(docs, sections)
  const latest = docs.filter((doc) => doc.slug !== HOME_DOC_SLUG)
  const trail: Crumb[] = [
    { name: "Docs", path: "/docs" },
    { name: "What's new", path: WHATS_NEW_PATH },
  ]

  return (
    <>
      <DocsLayout areas={areas} current={WHATS_NEW_PATH} breadcrumbs={trail}>
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
                      href={`/docs/${doc.slug}`}
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
                          className="aspect-[40/21] w-full shrink-0 rounded-sm border object-cover group-hover:opacity-80 sm:w-60"
                        />
                      )}
                      <span className="flex flex-col gap-2">
                        <span className="group-hover:text-foreground/80 font-sans text-xl leading-tight font-semibold tracking-tight text-balance md:text-2xl">
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
