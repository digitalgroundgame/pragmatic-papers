import { getGlobal } from "@/data/globals"

import { getTickerFeed } from "./getTickerFeed"
import { TickerView } from "./TickerView"

/**
 * The ticker, when it's switched on in the Header global. Renders nothing when it's off, or
 * when no source has anything to show.
 */
export async function Ticker(): Promise<React.ReactNode> {
  // The depth the header reads it at, so they share one cache entry.
  const { ticker } = await getGlobal("header", 1)
  if (ticker?.enabled !== true) return null
  return <TickerView {...await getTickerFeed()} />
}
