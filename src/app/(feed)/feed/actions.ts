"use server"

import { getFeedBatch } from "./getFeedBatch"
import { renderFeedArticle } from "./renderFeedArticle"
import type { FeedBatch } from "./types"

/**
 * The next page of the feed, rendered. Replaces the old `/api/feed` JSON
 * endpoint: article pages are server-rendered, so they have to travel as an
 * RSC payload rather than JSON.
 */
export async function loadFeedBatch(cursor: number): Promise<FeedBatch> {
  const batch = await getFeedBatch({ cursor: Math.max(1, Math.floor(cursor) || 1) })
  return { items: batch.items.map(renderFeedArticle), nextCursor: batch.nextCursor }
}
