"use client"

import { useEffect, useState } from "react"

import type { TickerFeed } from "./items"
import { TickerView } from "./TickerView"

/** Where the ticker's feed is served (`src/app/(frontend)/ticker.json/route.ts`). */
export const TICKER_FEED_PATH = "/ticker.json"

/** The ticker's box, empty: its section's margins and borders around its h-10 row. */
export function TickerPlaceholder(): React.ReactNode {
  return (
    <div aria-hidden="true" data-ticker-placeholder className="mb-6 border-b md:mb-10 md:border-t">
      <div className="h-10" />
    </div>
  )
}

/**
 * The ticker, fetched once the page has loaded. Until it arrives, an empty strip of the
 * ticker's height and margins holds its place, so the page below doesn't move when it lands.
 * A feed that fails or has nothing to show takes the strip away.
 */
export function TickerLoader(): React.ReactNode {
  const [feed, setFeed] = useState<TickerFeed | "loading" | null>("loading")

  useEffect(() => {
    const controller = new AbortController()
    fetch(TICKER_FEED_PATH, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<TickerFeed>) : null))
      .then(setFeed)
      .catch(() => {
        if (!controller.signal.aborted) setFeed(null)
      })
    return () => controller.abort()
  }, [])

  if (feed === "loading") return <TickerPlaceholder />
  if (!feed) return null
  return <TickerView {...feed} />
}
