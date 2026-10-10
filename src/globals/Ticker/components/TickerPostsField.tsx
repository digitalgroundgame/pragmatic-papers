import { getTickerPostLists } from "@/components/Ticker/getTickerFeed"

import { TickerPostsPicker } from "./TickerPostsPicker"

/**
 * The Ticker global's list of current posts, read on each view from the same caches the ticker
 * reads, so opening it never costs a source an extra read.
 */
export async function TickerPostsField(): Promise<React.ReactNode> {
  return <TickerPostsPicker lists={await getTickerPostLists()} />
}
