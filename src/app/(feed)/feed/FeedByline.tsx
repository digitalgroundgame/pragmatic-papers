"use client"

import React, { useEffect, useRef, useState } from "react"
import type { FeedArticle } from "./types"

interface FeedBylineProps {
  article: FeedArticle
}

// TikTok-style watermark anchored to the bottom of every interior page
// (content + block). Marquees horizontally if the line overflows the
// viewport. Stays pointer-events-none so taps fall through to the
// underlying article view.
export function FeedByline({ article }: FeedBylineProps): React.ReactNode {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const textRef = useRef<HTMLSpanElement | null>(null)
  const [marquee, setMarquee] = useState<{ shift: number; duration: number } | null>(null)

  const authorNames = (article.populatedAuthors ?? [])
    .map((a) => (typeof a === "object" && a.name ? a.name : ""))
    .filter(Boolean)
  const title = article.title

  // Decide whether to animate by measuring overflow on mount + on resize.
  useEffect(() => {
    const container = containerRef.current
    const text = textRef.current
    if (!container || !text) return

    const measure = (): void => {
      const overflow = text.scrollWidth - container.clientWidth
      if (overflow > 8) {
        // ~25 px/sec scroll speed plus a 1s pause at each end; the keyframe
        // halves the duration on each leg so we double it here.
        const duration = Math.max(8, overflow / 25 + 2) * 2
        setMarquee({ shift: overflow, duration })
      } else {
        setMarquee(null)
      }
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(container)
    ro.observe(text)
    return () => ro.disconnect()
  }, [authorNames.length, title])

  if (authorNames.length === 0 && !title) return null

  const line = [authorNames.join(", "), title].filter(Boolean).join(" · ")

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute right-0 bottom-0 left-0 overflow-hidden px-5"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 6px)" }}
      aria-hidden="true"
    >
      <span
        ref={textRef}
        className={
          marquee
            ? "text-foreground/45 feed-marquee inline-block font-sans text-[11px] tracking-wide whitespace-nowrap"
            : "text-foreground/45 block truncate font-sans text-[11px] tracking-wide"
        }
        style={
          marquee
            ? ({
                "--feed-marquee-shift": `${marquee.shift}px`,
                "--feed-marquee-duration": `${marquee.duration}s`,
              } as React.CSSProperties)
            : undefined
        }
      >
        {line}
      </span>
    </div>
  )
}
