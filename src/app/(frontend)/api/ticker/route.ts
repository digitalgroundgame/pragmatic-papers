import { getTickerFeed } from "@/components/Ticker/getTickerFeed"
import type { TickerFeed } from "@/components/Ticker/items"
import { getGlobal } from "@/data/globals"

/**
 * What the ticker shows right now, for `TickerLoader` to fetch once a page has loaded. The
 * ticker is read here rather than while the page renders, so its sources' five-minute caches
 * don't cut every page's own cache down to five minutes.
 *
 * Rendered per request from the sources' caches (`getTickerFeed`), and kept a minute at the
 * edge: a post an editor hides, or a stream that goes live, reaches readers within that minute
 * without purging any page.
 */
export async function GET(): Promise<Response> {
  // The depth the header reads it at, so they share one cache entry.
  const { ticker } = await getGlobal("header", 1)
  const feed: TickerFeed =
    ticker?.enabled === true ? await getTickerFeed() : { broadcast: null, posts: [] }
  return Response.json(feed, {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=600" },
  })
}

export const dynamic = "force-dynamic"
