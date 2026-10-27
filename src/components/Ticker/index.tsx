import { getGlobal } from "@/data/globals"

import { TickerLoader } from "./TickerLoader"

/**
 * The ticker, when it's switched on in the Header global. Renders nothing when it's off.
 * Its posts and broadcast are fetched in the browser (`TickerLoader`) rather than read here:
 * read while the page renders, its sources' five-minute caches would cut every page's own
 * cache down to five minutes.
 */
export async function Ticker(): Promise<React.ReactNode> {
  // The depth the header reads it at, so they share one cache entry.
  const { ticker } = await getGlobal("header", 1)
  if (ticker?.enabled !== true) return null
  return <TickerLoader />
}
