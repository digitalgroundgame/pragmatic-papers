import { LivePreviewListener } from "@/components/LivePreviewListener"
import { Pagination } from "@/components/Pagination"
import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import { paginatedPath } from "@/utilities/generateMeta"
import { getSiteURL } from "@/utilities/getURL"
import { mergeOpenGraph } from "@/utilities/mergeOpenGraph"
import type { Metadata } from "next"
import { draftMode } from "next/headers"
import { notFound } from "next/navigation"
import React, { cache } from "react"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { PageHeader, PageShell } from "@/components/PageShell"
import {
  articleCountsByTopic,
  LatestVolumePanel,
  MostReadPanel,
  NewsletterPanel,
  WithAside,
} from "@/components/Aside"
import { getPayloadClient } from "@/data/payload"

export async function generateMetadata({ searchParams }: Args): Promise<Metadata> {
  const { p } = await searchParams
  const canonicalUrl = `${getSiteURL()}${paginatedPath("/topics", p)}`

  return {
    title: "Topics | The Pragmatic Papers",
    description: "Browse all topics on Pragmatic Papers.",
    alternates: { canonical: canonicalUrl },
    openGraph: mergeOpenGraph({
      title: "Topics | The Pragmatic Papers",
      description: "Browse all topics on Pragmatic Papers.",
      url: canonicalUrl,
    }),
  }
}

const TOPICS_PER_PAGE = 50

const queryTopics = cache(async (page: number = 1) => {
  const { isEnabled: draft } = await draftMode()
  const payload = await getPayloadClient()

  return await payload.find({
    collection: "topics",
    draft,
    limit: TOPICS_PER_PAGE,
    page,
    pagination: true,
  })
})

interface Args {
  searchParams: Promise<{
    p?: string
  }>
}

export default async function TopicsPage({ searchParams }: Args): Promise<React.ReactNode> {
  const { isEnabled: draft } = await draftMode()
  const { p } = await searchParams
  let page = Number(p) || 1
  if (!Number.isInteger(page) || page < 1) page = 1

  const { docs: topics, totalPages, page: currentPage } = await queryTopics(page)
  const counts = await articleCountsByTopic()
  // A page past the last one would be an empty listing that names itself as canonical.
  if (page > 1 && page > totalPages) notFound()

  return (
    <>
      <Breadcrumbs shell items={[{ name: "Topics", path: "/topics" }]} />
      <PageShell>
        {draft && <LivePreviewListener />}

        <PageHeader title="Topics" description="Browse all topics" />

        <WithAside
          aside={
            <>
              <MostReadPanel />
              <LatestVolumePanel />
              <NewsletterPanel />
            </>
          }
        >
          <section aria-label="All topics">
            {topics.length === 0 ? (
              <p className="text-muted-foreground text-sm">No topics found.</p>
            ) : (
              <>
                <ul className="grid gap-x-8 sm:grid-cols-2">
                  {topics.map((topic) => {
                    const count = counts.get(topic.id) ?? 0
                    return (
                      <li key={topic.id} className="border-b">
                        <HoverPrefetchLink
                          href={`/topics/${topic.slug}`}
                          className="group/card block space-y-1 py-4"
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <h2 className="card-hover:text-foreground/80 mt-0! text-xl md:text-2xl">
                              {topic.name}
                            </h2>
                            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                              {count} {count === 1 ? "article" : "articles"}
                            </span>
                          </div>
                          {topic.description && (
                            <p className="text-muted-foreground line-clamp-2 font-serif text-sm">
                              {topic.description}
                            </p>
                          )}
                        </HoverPrefetchLink>
                      </li>
                    )
                  })}
                </ul>
                <Pagination
                  className="mt-18 flex justify-center"
                  page={currentPage}
                  totalPages={totalPages}
                />
              </>
            )}
          </section>
        </WithAside>
      </PageShell>
    </>
  )
}
