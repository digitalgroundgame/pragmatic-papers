import { blueskyPosts, podcastYouTube, xPosts } from "@/integrations"
import { describeStatus, integrationStatus, type Integration } from "@/integrations"

import { MAX_POSTS, type TickerBroadcast, type TickerPost } from "./items"

/**
 * Where the ticker's items come from. Adding a source: declare its connection in
 * `src/integrations/index.ts`, then add an entry here that maps what it returns onto
 * `TickerPost` (or `TickerBroadcast`), with how long its answer may be reused.
 */
/**
 * Which channel and accounts to read, as set on the Integrations global. Empty falls back to
 * each connection's variable, then its default.
 */
export interface TickerSettings {
  youtubeChannelId?: string | null
  blueskyHandle?: string | null
  xUsername?: string | null
}

export interface TickerSource<T> {
  integration: Integration
  /**
   * How long an answer is reused before the next request asks again, in seconds. Kept apart
   * per source because each costs something different: YouTube quota, X money, Bluesky
   * nothing.
   */
  revalidate: number
  load(signal: AbortSignal, settings: TickerSettings): Promise<T>
}

export const broadcastSource: TickerSource<TickerBroadcast | null> = {
  integration: podcastYouTube,
  // 2 quota units a check: every 2 minutes is ~1,440 of the 10,000 a day.
  revalidate: 120,
  async load(signal, settings) {
    const broadcast = await podcastYouTube.currentBroadcast({
      channelId: settings.youtubeChannelId,
      signal,
    })
    if (!broadcast) return null
    return {
      status: broadcast.status,
      title: broadcast.title,
      url: broadcast.url,
      startsAt: broadcast.scheduledStart,
    }
  },
}

export const postSources: TickerSource<TickerPost[]>[] = [
  {
    integration: blueskyPosts,
    revalidate: 300,
    async load(signal: AbortSignal, settings: TickerSettings): Promise<TickerPost[]> {
      const posts = await blueskyPosts.recentPosts({
        handle: settings.blueskyHandle,
        limit: MAX_POSTS,
        signal,
      })
      return posts.map((post) => ({
        id: `bluesky:${post.uri}`,
        source: "bluesky",
        text: post.text,
        url: post.url,
        createdAt: post.createdAt,
      }))
    },
  },
  {
    integration: xPosts,
    // Two paid reads a check, so it's checked least often.
    revalidate: 1800,
    async load(signal: AbortSignal, settings: TickerSettings): Promise<TickerPost[]> {
      const posts = await xPosts.recentPosts({
        username: settings.xUsername,
        limit: MAX_POSTS,
        signal,
      })
      return posts.map((post) => ({
        id: `x:${post.id}`,
        source: "x",
        text: post.text,
        url: post.url,
        createdAt: post.createdAt,
      }))
    },
  },
]

/** How long a source may take before the ticker goes on without it. */
const TIMEOUT_MS = 3000

/**
 * A source's items, or `fallback` when it isn't configured, is slow or fails. The ticker is
 * never worth an error page, and a source that's down shouldn't hold the home page up.
 */
export async function loadSource<T>(
  source: TickerSource<T>,
  fallback: T,
  settings: TickerSettings = {},
): Promise<T> {
  const status = integrationStatus(source.integration)
  if (!status.configured) {
    console.warn(`[ticker] skipping ${status.label}: ${describeStatus(status)}`)
    return fallback
  }
  try {
    return await source.load(AbortSignal.timeout(TIMEOUT_MS), settings)
  } catch (error) {
    console.warn(`[ticker] ${status.label} failed:`, error instanceof Error ? error.message : error)
    return fallback
  }
}
