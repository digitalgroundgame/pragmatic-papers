import { LivePreviewListener } from "@/components/LivePreviewListener"
import { Pagination } from "@/components/Pagination"
import { TopicsList } from "@/components/Topics/TopicsList"
import { getServerSideURL } from "@/utilities/getURL"
import { mergeOpenGraph } from "@/utilities/mergeOpenGraph"
import config from "@payload-config"
import type { Metadata } from "next"
import { draftMode } from "next/headers"
import { getPayload } from "payload"
import React, { cache } from "react"

export const metadata: Metadata = {
  title: "Topics | The Pragmatic Papers",
  description: "Browse all topics on Pragmatic Papers.",
  openGraph: mergeOpenGraph({
    title: "Topics | The Pragmatic Papers",
    description: "Browse all topics on Pragmatic Papers.",
    url: `${getServerSideURL()}/topics`,
  }),
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

  return (
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
            {totalPages > 1 && currentPage && (
              <div className="mt-6 flex justify-center">
                <Pagination page={currentPage} totalPages={totalPages} />
              </div>
            )}
          </>
        )}
      </section>
    </article>
  )
}
