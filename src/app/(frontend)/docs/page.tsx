import { Breadcrumbs, type Crumb } from "@/components/Breadcrumbs"
import { DocsLayout } from "@/components/DocsNav"
import { JsonLd } from "@/components/JsonLd"
import { docThumbnail } from "@/plugins/docs/notifications"
import { queryPublishedDocs } from "@/plugins/docs/queries"
import { groupDocsBySection } from "@/plugins/docs/sections"
import { formatNotificationDate } from "@/plugins/notifications/unread"
import { getServerSideURL } from "@/utilities/getURL"
import { mergeOpenGraph } from "@/utilities/mergeOpenGraph"
import { buildBreadcrumbJsonLd } from "@/utilities/structuredData"
import type { Metadata } from "next"
import Link from "next/link"
import React from "react"

const TITLE = "Docs — Pragmatic Papers"
const DESCRIPTION = "What's new in the Pragmatic Papers admin, and how to use it."

// Rendered per request from the data cache, which saving a doc or a deploy's docs sync refreshes:
// a prerendered copy would keep the docs the build saw.
export const dynamic = "force-dynamic"

export function generateMetadata(): Metadata {
  const canonicalUrl = `${getServerSideURL()}/docs`
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: canonicalUrl },
    openGraph: mergeOpenGraph({ title: TITLE, description: DESCRIPTION, url: canonicalUrl }),
  }
}

/** How many of the newest docs the index lists first. */
const LATEST = 3

export default async function DocsIndexPage(): Promise<React.ReactNode> {
  const docs = await queryPublishedDocs()
  const sections = groupDocsBySection(docs)
  const trail: Crumb[] = [{ name: "Docs", path: "/docs" }]

  return (
    <>
      <Breadcrumbs items={trail} className="max-w-7xl" />
      <DocsLayout sections={sections}>
        <article className="space-y-12">
          <JsonLd data={[buildBreadcrumbJsonLd(trail)]} />
          <header className="space-y-3">
            <h1>Docs</h1>
            <p className="text-muted-foreground text-sm">
              How to use the Pragmatic Papers admin, and what&apos;s new in it.
            </p>
          </header>
          {docs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No docs yet.</p>
          ) : (
            <>
              <section aria-labelledby="docs-latest" className="space-y-3">
                <h2 id="docs-latest" className="text-2xl">
                  What&apos;s new
                </h2>
                <ul className="divide-y border-y">
                  {docs.slice(0, LATEST).map((doc) => (
                    <li key={doc.id} className="py-3">
                      <Link
                        href={`/docs/${doc.slug}`}
                        className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
                      >
                        <span>{doc.title}</span>
                        <time
                          className="text-muted-foreground text-xs"
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
                  className="space-y-4"
                >
                  <h2 id={`docs-${section.value}`} className="text-2xl">
                    {section.label}
                  </h2>
                  <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {section.docs.map((doc) => {
                      const thumbnail = docThumbnail(doc.heroImage)
                      return (
                        <li key={doc.id}>
                          <Link
                            href={`/docs/${doc.slug}`}
                            className="group hover:border-foreground flex h-full flex-col overflow-hidden rounded-md border no-underline"
                          >
                            {thumbnail && (
                              // Decorative: the title under it says what the doc is about.
                              // eslint-disable-next-line @next/next/no-img-element -- Media's 300px thumbnail, already small
                              <img
                                src={thumbnail.url}
                                alt=""
                                loading="lazy"
                                width={300}
                                height={158}
                                className="aspect-[40/21] w-full border-b object-cover"
                              />
                            )}
                            <span className="flex flex-col gap-1 p-4">
                              <span className="font-semibold group-hover:underline">
                                {doc.title}
                              </span>
                              <span className="text-muted-foreground text-sm">{doc.summary}</span>
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
