"use client"

import { useEffect, useState } from "react"

import type { TickerFeed } from "./items"
import { TICKER_LABEL, TickerView } from "./TickerView"

/** Where the ticker's feed is served (`src/app/(frontend)/api/ticker/route.ts`). */
export const TICKER_FEED_PATH = "/api/ticker"

/**
 * The ticker as the server sends it, before its feed arrives: the "Latest" label where the real
 * one sits, in a strip of the ticker's size, margins and borders, so nothing moves when the
 * feed lands and the posts fade in beside it.
 */
export function TickerPlaceholder(): React.ReactNode {
  return (
    <div aria-hidden="true" data-ticker-placeholder className="mb-6 border-b md:mb-10 md:border-t">
      <div className="flex h-10 items-center gap-4 px-4 text-sm">
        <span className={TICKER_LABEL}>Latest</span>
      </div>
    </div>
  )
}

/**
 * The ticker, fetched once the page has loaded. Until it arrives, its placeholder holds its
 * place and shows its label, so the page below doesn't move when it lands.
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
