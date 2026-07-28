"use client"

import { Media } from "@/components/Media"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/utilities/utils"
import React, { useEffect, useRef, useState } from "react"
import type { FeedArticle } from "./types"

interface FeedBylineProps {
  article: FeedArticle
  className?: string
}

// Article-level identity banner that sits at the top of the article view,
// just under the page progress bars. Shows the hero thumbnail, the
// article title, and the author byline; marquees horizontally when the
// line overflows.
export function FeedByline({ article, className }: FeedBylineProps): React.ReactNode {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const textRef = useRef<HTMLSpanElement | null>(null)
  const [marquee, setMarquee] = useState<{ shift: number; duration: number } | null>(null)

  const authorNames = (article.populatedAuthors ?? [])
    .map((a) => (typeof a === "object" && a.name ? a.name : ""))
    .filter(Boolean)
  const title = article.title
  const heroImage = article.heroImage
  const heroImageObj = heroImage && typeof heroImage !== "number" ? heroImage : null
  const heroImageUrl =
    heroImageObj?.sizes?.square?.url ?? heroImageObj?.sizes?.thumbnail?.url ?? heroImageObj?.url

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

  if (!title && authorNames.length === 0) return null

  const line = [title, authorNames.join(", ")].filter(Boolean).join(" · ")

  return (
    <div className={cn("flex items-center gap-2 px-1", className)} aria-hidden="true">
      <Avatar
        size="sm"
        className="shrink-0 overflow-hidden rounded-full ring-1 ring-white/30 after:rounded-full"
      >
        <AvatarImage
          src={heroImageUrl ?? undefined}
          className="rounded-full"
          render={
            heroImageObj ? <Media media={heroImageObj} sizes="32px" variant="square" /> : undefined
          }
        />
        <AvatarFallback className="rounded-full bg-black/40 text-[10px] text-white">
          {title.slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div ref={containerRef} className="min-w-0 flex-1 overflow-hidden">
        <span
          ref={textRef}
          className={
            marquee
              ? "feed-marquee inline-block font-sans text-[12px] whitespace-nowrap text-white/70"
              : "block truncate font-sans text-[12px] text-white/70"
          }
          style={
            marquee
              ? ({
                  textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                  "--feed-marquee-shift": `${marquee.shift}px`,
                  "--feed-marquee-duration": `${marquee.duration}s`,
                } as React.CSSProperties)
              : { textShadow: "0 1px 2px rgba(0,0,0,0.6)" }
          }
        >
          {line}
        </span>
      </div>
    </div>
  )
}
