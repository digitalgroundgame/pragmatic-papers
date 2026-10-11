import { isExperimentEnabled } from "@/globals/SiteSettings/isExperimentEnabled"

import { getTickerFeed } from "./getTickerFeed"
import { TickerView } from "./TickerView"

/**
 * The ticker, when the `ticker` experiment is on. Renders nothing when it's off, or
 * when no source has anything to show.
 */
export async function Ticker(): Promise<React.ReactNode> {
  if (!(await isExperimentEnabled("ticker"))) return null
  return <TickerView {...await getTickerFeed()} />
}
