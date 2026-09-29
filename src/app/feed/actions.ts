"use server"

import { isExperimentEnabled } from "@/globals/SiteSettings/isExperimentEnabled"
import { getFeedBatch, MAX_FEED_PAGE } from "./getFeedBatch"
import { renderFeedArticle } from "./renderFeedArticle"
import type { FeedBatch } from "./types"

/**
 * The next page of the feed, rendered. Replaces the old `/api/feed` JSON
 * endpoint: article pages are server-rendered, so they have to travel as an
 * RSC payload rather than JSON. Server actions are public endpoints, so it
 * checks the feed experiment itself and serves nothing while it's off, and
 * answers a cursor past `MAX_FEED_PAGE` without querying at all.
 */
export async function loadFeedBatch(cursor: number): Promise<FeedBatch> {
  if (!(await isExperimentEnabled("feed"))) return { items: [], nextCursor: null }
  const page = Math.max(1, Math.floor(cursor) || 1)
  if (page > MAX_FEED_PAGE) return { items: [], nextCursor: null }
  const batch = await getFeedBatch({ cursor: page })
  return { items: batch.items.map(renderFeedArticle), nextCursor: batch.nextCursor }
}
