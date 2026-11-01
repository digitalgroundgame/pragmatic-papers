import { unstable_cache } from "next/cache"
import { cache } from "react"

import {
  mergePosts,
  TICKER_SETTINGS_TAG,
  withoutHidden,
  type TickerFeed,
  type TickerPost,
} from "./items"
import { getGlobal } from "@/data/globals"
import { getPayloadClient } from "@/data/payload"
import type { Header } from "@/payload-types"

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

async function readTickerSettings(): Promise<Header["ticker"]> {
  const payload = await getPayloadClient()
  const header = await payload.findGlobal({ slug: "header", depth: 0, select: { ticker: true } })
  return header.ticker
}

/**
 * The Header's ticker settings, in a cache entry of their own rather than the header's: an
 * editor hiding a post clears only this one, so no page, which renders from the header's,
 * goes stale. Uncached in development, as `getGlobal` is.
 */
const cachedTickerSettings = unstable_cache(readTickerSettings, ["ticker", "settings"], {
  tags: [TICKER_SETTINGS_TAG],
})

function getTickerSettings(): Promise<Header["ticker"]> {
  return process.env.NODE_ENV === "development" ? readTickerSettings() : cachedTickerSettings()
}
const posts = postSources.map((source) => cached(source.integration.id, source, []))

/**
 * What every source holds right now, and the links editors hid. Read once per request, by the
 * ticker and by the Header's list of posts in the admin, from the same caches, so opening
 * the admin never costs a source an extra read.
 */
const getTickerSources = cache(async () => {
  const [{ youtube, bluesky, x }, ticker] = await Promise.all([
    getGlobal("integrations"),
    getTickerSettings(),
  ])
  const settings: TickerSettings = {
    youtubeChannelIds: youtube?.channels?.map((channel) => channel.channelId),
    youtubeUpcomingHours: ticker?.upcomingHours,
    blueskyHandles: bluesky?.handles?.map((account) => account.handle),
    xUsernames: x?.usernames?.map((account) => account.username),
  }
  const [current, ...lists] = await Promise.all([
    broadcast(settings),
    ...posts.map((load) => load(settings)),
  ])
  return {
    broadcast: current,
    lists,
    hidden: ticker?.hidden?.map((post) => post.url) ?? [],
  }
})

/** Each source's posts, hidden ones included: what an editor picks from to hide. */
export const getTickerPostLists = cache(
  async (): Promise<TickerPost[][]> => (await getTickerSources()).lists,
)

/** Everything the ticker shows right now, from every source at once. */
export const getTickerFeed = cache(async (): Promise<TickerFeed> => {
  const { broadcast: current, lists, hidden } = await getTickerSources()
  // Hidden posts are left out before the newest are picked, so the ticker stays full. The hidden
  // list is cached apart from the sources, so a post an editor hides goes at once, whatever the
  // sources hold.
  return { broadcast: current, posts: mergePosts(lists.map((list) => withoutHidden(list, hidden))) }
})
