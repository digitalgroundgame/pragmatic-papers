import { LivePreviewListener } from "@/components/LivePreviewListener"
import { Pagination } from "@/components/Pagination"
import { TopicsList } from "@/components/Topics/TopicsList"
import { paginatedPath } from "@/utilities/generateMeta"
import { getSiteURL } from "@/utilities/getURL"
import { mergeOpenGraph } from "@/utilities/mergeOpenGraph"
import config from "@payload-config"
import type { Metadata } from "next"
import { draftMode } from "next/headers"
import { notFound } from "next/navigation"
import { getPayload } from "payload"
import React, { cache } from "react"
import { Breadcrumbs } from "@/components/Breadcrumbs"

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
  const payload = await getPayload({ config })

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
  // A page past the last one would be an empty listing that names itself as canonical.
  if (page > 1 && page > totalPages) notFound()

  return (
    <>
      <Breadcrumbs items={[{ name: "Topics", path: "/topics" }]} />
      <article className="mx-auto max-w-3xl space-y-6 px-4">
        {draft && <LivePreviewListener />}

        <header className="space-y-3">
          <h1>Topics</h1>
          <p className="text-muted-foreground text-sm">Browse all topics</p>
        </header>

        <section aria-label="All topics" className="mt-6">
          {topics.length === 0 ? (
            <p className="text-muted-foreground text-sm">No topics found.</p>
          ) : (
            <>
              <div className="mt-6 flex justify-center">
                <TopicsList topics={topics} />
              </div>
              <Pagination
                className="mt-18 flex justify-center"
                page={currentPage}
                totalPages={totalPages}
              />
            </>
          )}
        </section>
      </article>
    </>
  )
}
