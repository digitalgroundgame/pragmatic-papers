import { cache } from "react"

import { getPayloadClient } from "@/data/payload"
import type { Media as MediaType } from "@/payload-types"

/**
 * Reads for the topics list. Plain SQL through the adapter's pool rather than
 * `@payloadcms/db-postgres`'s `sql`: the Topics list block is in `RenderBlocks`, which
 * Storybook bundles for the browser, and that package can't be.
 */
const rows = async <T>(text: string): Promise<T[]> => {
  const payload = await getPayloadClient()
  const { pool } = payload.db as unknown as {
    pool: { query: (text: string) => Promise<{ rows: T[] }> }
  }
  return (await pool.query(text)).rows
}

/** Published articles per topic, by topic id. */
export const articleCountsByTopic = cache(async (): Promise<Map<number, number>> => {
  const counts = await rows<{ id: number; count: number }>(`
    SELECT r.topics_id AS id, COUNT(*)::int AS count
      FROM articles_rels r JOIN articles a ON a.id = r.parent_id AND a._status = 'published'
     WHERE r.path = 'topics' GROUP BY r.topics_id
  `)
  return new Map(counts.map((c) => [c.id, c.count]))
})

/** Each topic's cover until it has its own: the picture of its newest published article. */
export const topicCovers = cache(async (): Promise<Map<number, MediaType>> => {
  const picks = await rows<{ topic: number; media: number }>(`
    SELECT DISTINCT ON (r.topics_id) r.topics_id AS topic, a.meta_image_id AS media
      FROM articles_rels r JOIN articles a ON a.id = r.parent_id AND a._status = 'published'
     WHERE r.path = 'topics' AND a.meta_image_id IS NOT NULL
     ORDER BY r.topics_id, a.published_at DESC NULLS LAST
  `)
  if (!picks.length) return new Map()
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: "media",
    where: { id: { in: picks.map((p) => p.media) } },
    pagination: false,
    depth: 0,
  })
  const byId = new Map(docs.map((d) => [d.id, d]))
  return new Map(
    picks.flatMap((p) => {
      const media = byId.get(p.media)
      return media ? [[p.topic, media] as const] : []
    }),
  )
})
