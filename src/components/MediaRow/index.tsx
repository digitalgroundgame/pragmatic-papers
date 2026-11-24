import React from "react"

import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import { PaperIcon } from "@/components/Logo/icons/PaperIcon"
import { Media, isMedia } from "@/components/Media"
import { Badge } from "@/components/ui/badge"
import type { Media as MediaType } from "@/payload-types"
import { cn } from "@/utilities/utils"

/**
 * PROTOTYPE: the one compact card. No border, no padding box: a fixed 3:2 thumbnail, the title,
 * a line of summary, the byline, then the topics as badges, spaced apart with whitespace.
 * The title's link stretches over the whole row (`after:inset-0`), so the row clicks as one
 * and reacts as one (`group/card`, `card-hover:`), while the badges stay links of their own.
 */
export function MediaRow({
  href,
  title,
  summary,
  byline,
  meta,
  badges,
  image,
  size = "default",
  className,
}: {
  href: string
  title: React.ReactNode
  summary?: string | null
  /** "by …", on its own line. */
  byline?: React.ReactNode
  /** A short muted line: a kind, a count, a volume. */
  meta?: React.ReactNode
  /** Topic badges, each a link of its own. */
  badges?: { label: string; href: string }[]
  image?: MediaType | number | null
  /** `lg` for short titles that should read as headings, like a topic's name. */
  size?: "default" | "lg"
  className?: string
}): React.ReactNode {
  return (
    <div className={cn("group/card relative flex gap-4", className)}>
      {/* The frame is always there, at one size and ratio, so rows line up with or without a picture. */}
      <div className="bg-muted relative aspect-3/2 w-28 shrink-0 self-start overflow-hidden rounded-sm sm:w-40">
        {isMedia(image) ? (
          <Media
            media={image}
            variant="thumbnail"
            sizes="(max-width: 640px) 112px, 160px"
            className="card-hover:brightness-[1.02] card-hover:contrast-[1.16] card-hover:saturate-[1.16] absolute inset-0 h-full w-full object-cover transition-[filter] duration-300 ease-out"
          />
        ) : (
          <PaperIcon
            aria-hidden="true"
            className="text-muted-foreground/40 absolute inset-0 m-auto size-8"
          />
        )}
      </div>
      <div className="min-w-0 space-y-1">
        <h3
          className={cn(
            "card-hover:text-foreground/80 mt-0! line-clamp-2 leading-tight text-pretty",
            // The h3 token (24 / 32px) is FKScreamer's floor; `lg` is the h2 step.
            size === "lg" && "text-3xl md:text-4xl",
          )}
        >
          <HoverPrefetchLink href={href} className="after:absolute after:inset-0">
            {title}
          </HoverPrefetchLink>
        </h3>
        {summary && (
          <p className="text-muted-foreground line-clamp-2 font-serif text-sm">{summary}</p>
        )}
        {byline && <p className="text-foreground text-sm">{byline}</p>}
        {meta && <p className="text-muted-foreground text-xs">{meta}</p>}
        {badges && badges.length > 0 && (
          <ul className="relative z-10 flex flex-wrap gap-1.5 pt-1">
            {badges.map((b) => (
              <li key={b.href}>
                <Badge
                  variant="brand"
                  render={
                    <HoverPrefetchLink href={b.href} className="hover:underline">
                      {b.label}
                    </HoverPrefetchLink>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/** Rows of `MediaRow`, spaced apart; `columns` sets two side by side from md up. */
export function MediaRowList({
  columns = 1,
  children,
  className,
}: {
  columns?: 1 | 2
  children: React.ReactNode
  className?: string
}): React.ReactNode {
  return (
    <div
      className={cn(columns === 2 ? "grid gap-x-8 gap-y-6 md:grid-cols-2" : "space-y-6", className)}
    >
      {children}
    </div>
  )
}
