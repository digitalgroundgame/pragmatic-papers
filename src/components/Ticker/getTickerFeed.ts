import { unstable_cache } from "next/cache"
import { cache } from "react"

import { mergePosts, withoutHidden, type TickerFeed, type TickerPost } from "./items"
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

/**
 * What every source holds right now, and the links editors hid. Read once per request, by the
 * ticker and by the Ticker global's list of posts in the admin, from the same caches, so opening
 * the admin never costs a source an extra read.
 */
const getTickerSources = cache(async () => {
  const [{ youtube, bluesky, x }, { hidden }] = await Promise.all([
    getCachedGlobal("integrations")(),
    getCachedGlobal("ticker")(),
  ])
  const settings: TickerSettings = {
    youtubeChannelIds: youtube?.channels?.map((channel) => channel.channelId),
    blueskyHandles: bluesky?.handles?.map((account) => account.handle),
    xUsernames: x?.usernames?.map((account) => account.username),
  }
  const [current, ...lists] = await Promise.all([
    broadcast(settings),
    ...posts.map((load) => load(settings)),
  ])
  return { broadcast: current, lists, hidden: hidden?.map((post) => post.url) ?? [] }
})

/** Each source's posts, hidden ones included: what an editor picks from to hide. */
export const getTickerPostLists = cache(
  async (): Promise<TickerPost[][]> => (await getTickerSources()).lists,
)

/** Everything the ticker shows right now, from every source at once. */
export const getTickerFeed = cache(async (): Promise<TickerFeed> => {
  const { broadcast: current, lists, hidden } = await getTickerSources()
  // Hidden posts are left out before the newest are picked, so the ticker stays full. The hidden
  // list has its own cache, so a post an editor hides goes at once, whatever the sources hold.
  return { broadcast: current, posts: mergePosts(lists.map((list) => withoutHidden(list, hidden))) }
})
