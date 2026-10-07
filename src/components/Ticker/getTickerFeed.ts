import { unstable_cache } from "next/cache"
import { cache } from "react"

import { mergePosts, type TickerFeed } from "./items"
import { broadcastSource, loadSource, postSources, type TickerSource } from "./sources"

/**
 * One source's answer, cached across requests for its own `revalidate`. A failure is cached
 * too (as the empty fallback), so a service that's down costs one slow request per period, not
 * one per reader. Next serves the cached answer while it refreshes in the background, so only
 * the first request after a deploy waits on the service.
 */
function cached<T>(key: string, source: TickerSource<T>, fallback: T): () => Promise<T> {
  return unstable_cache(() => loadSource(source, fallback), ["ticker", key], {
    revalidate: source.revalidate,
    tags: ["ticker"],
  })
}

const broadcast = cached("broadcast", broadcastSource, null)
const posts = postSources.map((source) => cached(source.integration.id, source, []))

/** Everything the ticker shows right now, from every source at once. */
export const getTickerFeed = cache(async (): Promise<TickerFeed> => {
  const [current, ...lists] = await Promise.all([broadcast(), ...posts.map((load) => load())])
  return { broadcast: current, posts: mergePosts(lists) }
})
