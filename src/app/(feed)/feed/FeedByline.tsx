"use client"

import React from "react"
import type { FeedArticle } from "./types"

interface FeedBylineProps {
  article: FeedArticle
}

// TikTok-style watermark anchored to the bottom of every interior page
// (content + block). Subtle, never interactive, never gates the gesture
// surface — uses pointer-events-none so taps fall through to the
// underlying article view.
export function FeedByline({ article }: FeedBylineProps): React.ReactNode {
  const authorNames = (article.populatedAuthors ?? [])
    .map((a) => (typeof a === "object" && a.name ? a.name : ""))
    .filter(Boolean)
  const volume = article.populatedVolume

  if (authorNames.length === 0 && !volume?.title) return null

  return (
    <div
      className="pointer-events-none absolute right-0 bottom-0 left-0 px-5"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 6px)" }}
      aria-hidden="true"
    >
      <p className="text-foreground/45 truncate font-sans text-[11px] tracking-wide">
        {authorNames.join(", ")}
        {authorNames.length > 0 && volume?.title ? " · " : ""}
        {volume?.title ?? ""}
      </p>
    </div>
  )
}
