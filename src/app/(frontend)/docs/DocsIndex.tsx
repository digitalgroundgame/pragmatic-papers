import { Breadcrumbs, type Crumb } from "@/components/Breadcrumbs"
import { DocsLayout } from "@/components/DocsNav"
import { JsonLd } from "@/components/JsonLd"
import { docThumbnail } from "@/plugins/docs/thumbnail"
import type { queryPublishedDocs } from "@/plugins/docs/queries"
import { groupDocsBySection } from "@/plugins/docs/sections"
import { formatNotificationDate } from "@/plugins/notifications/unread"
import { buildBreadcrumbJsonLd } from "@/utilities/structuredData"
import Link from "next/link"
import React from "react"

/** How many of the newest docs the index lists; the sidebar lists every doc. */
const LATEST = 8

/** The small serif label over a list, as the sidebar labels its sections. */
const KICKER = "text-muted-foreground font-serif text-sm font-bold tracking-wider uppercase"

export type DocsIndexDoc = Awaited<ReturnType<typeof queryPublishedDocs>>[number]

/** The /docs index: the newest docs with their thumbnails, beside the sidebar of every doc. */
export function DocsIndex({ docs }: { docs: DocsIndexDoc[] }): React.ReactNode {
  const sections = groupDocsBySection(docs)
  const trail: Crumb[] = [{ name: "Docs", path: "/docs" }]

  return (
    <>
      <Breadcrumbs items={trail} className="max-w-7xl" />
      <DocsLayout sections={sections}>
        <article className="space-y-10">
          <JsonLd data={[buildBreadcrumbJsonLd(trail)]} />
          <header className="space-y-3">
            <h1>Docs</h1>
            <p className="text-foreground max-w-2xl font-serif text-lg">
              How to use the Pragmatic Papers admin, and what&apos;s new in it.
            </p>
          </header>
          {docs.length === 0 ? (
            <p className="text-muted-foreground font-serif">No docs yet.</p>
          ) : (
            <section aria-labelledby="docs-latest">
              <h2 id="docs-latest" className={KICKER}>
                What&apos;s new
              </h2>
              <ul className="mt-3 border-t">
                {docs.slice(0, LATEST).map((doc) => {
                  const thumbnail = docThumbnail(doc.heroImage)
                  return (
                    <li key={doc.id} className="border-b py-6">
                      <Link
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
                          <span className="font-display group-hover:text-foreground/80 text-2xl leading-none font-bold tracking-wide text-balance md:text-3xl">
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
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </article>
      </DocsLayout>
    </>
  )
}
