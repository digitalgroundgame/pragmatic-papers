import { draftMode } from "next/headers"
import { notFound } from "next/navigation"
import React, { cache } from "react"

import { articleCountsByTopic, topicCovers } from "@/data/topics"
import { Pagination } from "@/components/Pagination"
import { Tile, TileList } from "@/components/Tile"
import { getPayloadClient } from "@/data/payload"
import type { TopicsListBlock as TopicsListBlockProps } from "@/payload-types"

export const TOPICS_PER_PAGE = 50

const queryTopics = cache(async (page: number) => {
  const { isEnabled: draft } = await draftMode()
  const payload = await getPayloadClient()
  return payload.find({
    collection: "topics",
    draft,
    limit: TOPICS_PER_PAGE,
    page,
    pagination: true,
  })
})

export async function TopicsListBlock({
  emptyMessage,
  pageNumber = 1,
}: Pick<TopicsListBlockProps, "emptyMessage"> & { pageNumber?: number }): Promise<React.ReactNode> {
  const [{ docs: topics, totalPages, page }, counts, covers] = await Promise.all([
    queryTopics(pageNumber),
    articleCountsByTopic(),
    topicCovers(),
  ])
  // A page past the last one would be an empty listing that names itself as canonical.
  if (pageNumber > 1 && pageNumber > totalPages) notFound()

  return (
    <section aria-label="All topics">
      {topics.length === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyMessage || "No topics found."}</p>
      ) : (
        <>
          <TileList>
            {topics.map((topic) => {
              const count = counts.get(topic.id) ?? 0
              return (
                <Tile
                  key={topic.id}
                  titleSize="lg"
                  href={`/topics/${topic.slug}`}
                  title={topic.name}
                  summary={topic.description}
                  image={topic.meta?.image ?? covers.get(topic.id)}
                  meta={`${count} ${count === 1 ? "article" : "articles"}`}
                />
              )
            })}
          </TileList>
          <Pagination
            className="mt-18 flex justify-center"
            page={page ?? pageNumber}
            totalPages={totalPages}
          />
        </>
      )}
    </section>
  )
}
