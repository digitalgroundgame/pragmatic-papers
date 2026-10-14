"use client"

import { useEffect, useState } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/utilities/utils"

import type { TickerFeed } from "./items"
import { TICKER_LABEL, TickerView } from "./TickerView"

/** Where the ticker's feed is served (`src/app/(frontend)/api/ticker/route.ts`). */
export const TICKER_FEED_PATH = "/api/ticker"

/** How wide each placeholder post's words are: a few lengths, so it reads as a line of posts. */
const SKELETON_POSTS = ["w-72", "w-96", "w-56", "w-80", "w-64"]

/**
 * The ticker as the server sends it, before its feed arrives: the "Latest" label where the real
 * one sits, and a row of grey posts, each a source icon and a line of words, in the posts'
 * own spacing. It's the ticker's size, margins and borders, so nothing moves when the feed
 * lands. Skeletons pulse unless the reader asks for reduced motion.
 */
export function TickerPlaceholder(): React.ReactNode {
  return (
    <div aria-hidden="true" data-ticker-placeholder className="mb-6 border-b md:mb-10 md:border-t">
      <div className="flex h-10 items-center gap-4 px-4 text-sm">
        <span className={TICKER_LABEL}>Latest</span>
        <div className="ticker-viewport flex min-w-0 flex-1 overflow-hidden">
          <ul className="flex shrink-0 items-center gap-6 pr-6">
            {SKELETON_POSTS.map((width, index) => (
              <li key={index} data-ticker-skeleton className="flex shrink-0 items-center gap-6">
                <span className="bg-muted size-1 rounded-full" />
                <span className="flex items-center gap-2">
                  <Skeleton className="size-3 shrink-0 rounded-full motion-reduce:animate-none" />
                  <Skeleton className={cn("h-3 rounded-sm motion-reduce:animate-none", width)} />
                </span>
              </li>
            ))}
          </ul>
        </div>
        {/* Where the pause switch will sit, so the posts' fade ends where the ticker's does. */}
        <span className="-ml-2 size-7 shrink-0" />
      </div>
    </div>
  )
}

/**
 * The ticker, fetched once the page has loaded. Until it arrives, its placeholder holds its
 * place, label and skeletons, so the page below doesn't move when it lands.
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
