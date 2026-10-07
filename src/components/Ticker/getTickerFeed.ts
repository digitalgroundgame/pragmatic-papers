import { unstable_cache } from "next/cache"
import { cache } from "react"

import { mergePosts, type TickerFeed } from "./items"
import { getCachedGlobal } from "@/utilities/getGlobals"

import {
  broadcastSource,
  loadSource,
  postSources,
  type TickerSettings,
  type TickerSource,
} from "./sources"

/**
 * One source's answer, cached across requests for its own `revalidate`. A failure is cached
 * too (as the empty fallback), so a service that's down costs one slow request per period, not
 * one per reader. Next serves the cached answer while it refreshes in the background, so only
 * the first request after a deploy waits on the service.
 */
function cached<T>(
  key: string,
  source: TickerSource<T>,
  fallback: T,
): (settings: TickerSettings) => Promise<T> {
  // The settings are an argument, so they're part of the cache key: a new channel or account
  // is read at once rather than when the old answer expires.
  return unstable_cache((settings) => loadSource(source, fallback, settings), ["ticker", key], {
    revalidate: source.revalidate,
    tags: ["ticker"],
  })
}

const broadcast = cached("broadcast", broadcastSource, null)
const posts = postSources.map((source) => cached(source.integration.id, source, []))

/** Everything the ticker shows right now, from every source at once. */
export const getTickerFeed = cache(async (): Promise<TickerFeed> => {
  const { youtube, bluesky, x } = await getCachedGlobal("integrations")()
  const settings: TickerSettings = {
    youtubeChannelIds: youtube?.channels?.map((channel) => channel.channelId),
    blueskyHandle: bluesky?.handle,
    xUsername: x?.username,
  }
  const [current, ...lists] = await Promise.all([
    broadcast(settings),
    ...posts.map((load) => load(settings)),
  ])
  return { broadcast: current, posts: mergePosts(lists) }
})
