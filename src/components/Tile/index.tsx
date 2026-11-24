import { cva, type VariantProps } from "class-variance-authority"
import React from "react"

import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import { PaperIcon } from "@/components/Logo/icons/PaperIcon"
import { Media, isMedia } from "@/components/Media"
import { Badge } from "@/components/ui/badge"
import type { Media as MediaType } from "@/payload-types"
import { cn } from "@/utilities/utils"

/**
 * PROTOTYPE: the site's one card. No border and no padding box: a thumbnail in a fixed
 * frame, the title, and whichever of summary, byline, meta and badges it's given.
 *
 * - `layout`: `row` puts the thumbnail beside the text (lists); `stacked` puts it on top (grids).
 * - `density`: `compact` is the aside's: a small square-ish thumb and a two-line title, nothing else.
 * - `ratio`: the frame's shape. The frame always renders, so tiles line up with or without a picture.
 *
 * In a row every line is clamped to one, so the thumbnail sets the height and every row in a
 * list matches. The title's link stretches over the whole tile (`after:inset-0`): it clicks and
 * reacts as one (`group/card`, `card-hover:`), while the byline and badges stay links of their own.
 */
const tileVariants = cva("group/card relative flex", {
  variants: {
    layout: { row: "items-start gap-4", stacked: "flex-col gap-3" },
    density: { default: "", compact: "items-center gap-3" },
  },
  defaultVariants: { layout: "row", density: "default" },
})

const frameVariants = cva("bg-muted relative shrink-0 overflow-hidden rounded-sm", {
  variants: {
    layout: { row: "w-28 sm:w-40", stacked: "w-full" },
    // tailwind-merge (`cn`) lets these win over the row widths above.
    density: { default: "", compact: "w-16 sm:w-16" },
    ratio: { video: "aspect-video", landscape: "aspect-4/3", square: "aspect-square" },
  },
  defaultVariants: { layout: "row", density: "default", ratio: "landscape" },
})

const titleVariants = cva("card-hover:text-foreground/80 mt-0! leading-tight", {
  variants: {
    layout: { row: "line-clamp-1", stacked: "line-clamp-3 text-balance" },
    // The h3 token (24 / 32px) is FKScreamer's floor. `lg` is the h2 step; `compact` holds the
    // floor at every width, since 32px is too big for an aside.
    titleSize: { default: "", lg: "text-3xl md:text-4xl" },
    density: { default: "", compact: "line-clamp-2 text-2xl md:text-2xl" },
  },
  defaultVariants: { layout: "row", titleSize: "default", density: "default" },
})

export interface TileProps
  extends VariantProps<typeof tileVariants>, VariantProps<typeof frameVariants> {
  href: string
  title: React.ReactNode
  image?: MediaType | number | null
  summary?: string | null
  /** The authors, on their own line: `<Byline size="sm">`. */
  byline?: React.ReactNode
  /** A short muted line: a kind, a count. */
  meta?: React.ReactNode
  /** Topic badges, each a link of its own. */
  badges?: { label: string; href: string }[]
  /** A place in a ranking, drawn to the left of the thumbnail. */
  rank?: number
  titleSize?: "default" | "lg"
  className?: string
}

export function Tile({
  href,
  title,
  image,
  summary,
  byline,
  meta,
  badges,
  rank,
  layout = "row",
  density = "default",
  ratio,
  titleSize,
  className,
}: TileProps): React.ReactNode {
  const compact = density === "compact"
  return (
    <div className={cn(tileVariants({ layout, density }), className)}>
      {rank != null && (
        <span className="text-muted-foreground font-display w-5 shrink-0 text-center text-3xl leading-none tabular-nums">
          {rank}
        </span>
      )}
      <div className={cn(frameVariants({ layout, density, ratio }))}>
        {isMedia(image) ? (
          <Media
            media={image}
            variant={ratio === "square" ? "square" : "thumbnail"}
            sizes={
              compact
                ? "64px"
                : layout === "stacked"
                  ? "(max-width: 768px) 100vw, 400px"
                  : "(max-width: 640px) 112px, 160px"
            }
            className="card-hover:brightness-[1.02] card-hover:contrast-[1.16] card-hover:saturate-[1.16] absolute inset-0 h-full w-full object-cover transition-[filter] duration-300 ease-out"
          />
        ) : (
          <PaperIcon
            aria-hidden="true"
            className={cn(
              "text-muted-foreground/40 absolute inset-0 m-auto",
              compact ? "size-5" : "size-8",
            )}
          />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <h3 className={cn(titleVariants({ layout, titleSize, density }))}>
          <HoverPrefetchLink href={href} className="after:absolute after:inset-0">
            {title}
          </HoverPrefetchLink>
        </h3>
        {!compact && summary && (
          <p
            className={cn(
              "text-muted-foreground font-serif text-sm",
              layout === "row" ? "line-clamp-1 max-sm:hidden" : "line-clamp-2",
            )}
          >
            {summary}
          </p>
        )}
        {!compact && byline && (
          <div className="relative z-10 overflow-hidden text-sm whitespace-nowrap">{byline}</div>
        )}
        {!compact && meta && <p className="text-muted-foreground text-xs">{meta}</p>}
        {!compact && badges && badges.length > 0 && (
          // One row of badges: any that don't fit wrap onto a second line that's cut off.
          <ul className="relative z-10 flex max-h-6 flex-wrap gap-1.5 overflow-hidden pt-1">
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

/** Tiles in a list or grid, spaced apart with whitespace, no rules. */
export function TileList({
  columns = 1,
  as: Tag = "div",
  children,
  className,
}: {
  columns?: 1 | 2 | 3
  as?: "div" | "ol" | "ul"
  children: React.ReactNode
  className?: string
}): React.ReactNode {
  return (
    <Tag
      className={cn(
        columns === 1 && "space-y-6",
        columns === 2 && "grid gap-x-8 gap-y-6 md:grid-cols-2",
        columns === 3 && "grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {children}
    </Tag>
  )
}
