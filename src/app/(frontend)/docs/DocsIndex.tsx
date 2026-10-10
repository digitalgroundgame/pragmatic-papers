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

/** How many of the newest docs the index lists first. */
const LATEST = 3

/** The site's kicker: the small brand-colored label over a list. */
const KICKER = "text-brand-text font-serif text-sm font-bold tracking-wider uppercase"

export type DocsIndexDoc = Awaited<ReturnType<typeof queryPublishedDocs>>[number]

/** The /docs index: the newest docs, then a card per doc under each section, beside the sidebar. */
export function DocsIndex({ docs }: { docs: DocsIndexDoc[] }): React.ReactNode {
  const sections = groupDocsBySection(docs)
  const trail: Crumb[] = [{ name: "Docs", path: "/docs" }]

  return (
    <>
      <Breadcrumbs items={trail} className="max-w-7xl" />
      <DocsLayout sections={sections}>
        <article className="space-y-14">
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
            <>
              <section aria-labelledby="docs-latest">
                <h2 id="docs-latest" className={KICKER}>
                  What&apos;s new
                </h2>
                <ul className="mt-3 border-t">
                  {docs.slice(0, LATEST).map((doc) => (
                    <li key={doc.id} className="border-b py-4">
                      <Link href={`/docs/${doc.slug}`} className="group block space-y-1">
                        <span className="font-display group-hover:text-foreground/80 block text-2xl leading-none font-bold tracking-wide text-balance">
                          {doc.title}
                        </span>
                        <time
                          className="text-brand-text block font-serif text-sm font-semibold"
                          dateTime={doc.publishedAt.slice(0, 10)}
                        >
                          {formatNotificationDate(doc.publishedAt)}
                        </time>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
              {sections.map((section) => (
                <section
                  key={section.value}
                  aria-labelledby={`docs-${section.value}`}
                  className="space-y-6"
                >
                  <h2 id={`docs-${section.value}`} className="border-brand border-l-4 pl-3">
                    {section.label}
                  </h2>
                  <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
                    {section.docs.map((doc) => {
                      const thumbnail = docThumbnail(doc.heroImage)
                      return (
                        <li key={doc.id}>
                          <Link href={`/docs/${doc.slug}`} className="group flex flex-col gap-2">
                            {thumbnail && (
                              // Decorative: the title under it says what the doc is about.
                              // eslint-disable-next-line @next/next/no-img-element -- Media's 300px thumbnail, already small
                              <img
                                src={thumbnail.url}
                                alt=""
                                loading="lazy"
                                width={300}
                                height={158}
                                className="aspect-[40/21] w-full rounded-sm border object-cover group-hover:opacity-80"
                              />
                            )}
                            <span className="font-display group-hover:text-foreground/80 mt-1 text-2xl leading-none font-bold tracking-wide text-balance">
                              {doc.title}
                            </span>
                            <span className="text-foreground line-clamp-3 font-serif leading-snug">
                              {doc.summary}
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </>
          )}
        </article>
      </DocsLayout>
    </>
  )
}
