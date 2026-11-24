import { cva, type VariantProps } from "class-variance-authority"
import React from "react"

import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import { PaperIcon } from "@/components/Logo/icons/PaperIcon"
import { Media, isMedia } from "@/components/Media"
import type { ImageVariant } from "@/components/Media/CMSImage"
import { Badge } from "@/components/ui/badge"
import type { Media as MediaType } from "@/payload-types"
import { cn } from "@/utilities/utils"

/**
 * PROTOTYPE: the site's one card. No border and no padding box: a thumbnail in a fixed
 * frame, the title, and whichever of summary, byline, meta and badges it's given.
 *
 * - `layout`: `row` puts the thumbnail beside the text (lists); `stacked` puts it on top (grids);
 *   `split` gives picture and text half the width each from md up (a featured tile).
 * - `imagePosition`: `start` (above, or left) or `end` (below, or right); `none` drops the frame.
 * - `density`: `compact` is the aside's: a small square-ish thumb and a two-line title, nothing else.
 * - `ratio`: the frame's shape. The frame always renders, so tiles line up with or without a picture.
 *
 * In a row every line is clamped to one, so the thumbnail sets the height and every row in a
 * list matches. The title's link stretches over the whole tile (`after:inset-0`): it clicks and
 * reacts as one (`group/card`, `card-hover:`), while the byline and badges stay links of their own.
 */
const tileVariants = cva("group/card relative flex", {
  variants: {
    layout: {
      row: "items-start gap-4",
      stacked: "flex-col gap-3",
      split: "flex-col gap-x-6 gap-y-3 md:flex-row md:items-center",
    },
    density: { default: "", compact: "items-start gap-3" },
    imagePosition: { start: "", end: "", none: "" },
  },
  compoundVariants: [
    { layout: "stacked", imagePosition: "end", className: "flex-col-reverse" },
    { layout: "split", imagePosition: "end", className: "md:flex-row-reverse" },
    { layout: "row", imagePosition: "end", className: "flex-row-reverse" },
  ],
  defaultVariants: { layout: "row", density: "default", imagePosition: "start" },
})

// A thin border on the picture (not the card): it adds no padding.
const frameVariants = cva("bg-muted relative shrink-0 overflow-hidden rounded-sm border", {
  variants: {
    layout: { row: "w-28 sm:w-40", stacked: "w-full", split: "w-full md:basis-1/2" },
    // tailwind-merge (`cn`) lets these win over the row widths above.
    density: { default: "", compact: "w-16 sm:w-16" },
    ratio: { video: "aspect-video", landscape: "aspect-4/3", square: "aspect-square" },
  },
  defaultVariants: { layout: "row", density: "default", ratio: "landscape" },
})

const titleVariants = cva("card-hover:text-foreground/80 mt-0! leading-tight", {
  variants: {
    layout: { row: "line-clamp-1", stacked: "line-clamp-3 text-balance", split: "text-balance" },
    // The h3 token (24 / 32px) is FKScreamer's floor. `lg` is the h2 step; `fluid` grows with
    // the tile's own width (a container query), for grids whose cells differ in size; `compact`
    // holds the floor at every width, since 32px is too big for an aside.
    titleSize: {
      default: "",
      lg: "text-3xl md:text-4xl",
      fluid: "text-2xl @sm:text-3xl @md:text-4xl @lg:text-5xl",
    },
    density: { default: "", compact: "line-clamp-none text-2xl md:text-2xl" },
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
  /** A short label above the title, in the serif eyebrow style. */
  kicker?: React.ReactNode
  /** When it was published: `<TimeAgo>`. */
  date?: React.ReactNode
  titleSize?: "default" | "lg" | "fluid"
  /** The picture's rendition and `sizes`, and whether it's above the fold. */
  imageVariant?: ImageVariant
  sizes?: string
  preload?: boolean
  loading?: "eager" | "lazy"
  id?: string
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
  kicker,
  date,
  imageVariant,
  sizes,
  preload,
  loading,
  id,
  imagePosition = "start",
  layout = "row",
  density = "default",
  ratio,
  titleSize,
  className,
}: TileProps): React.ReactNode {
  const compact = density === "compact"
  const row = layout === "row"
  return (
    <div
      id={id}
      className={cn(tileVariants({ layout, density, imagePosition }), "@container", className)}
    >
      {imagePosition !== "none" && (
        <div className={cn(frameVariants({ layout, density, ratio }))}>
          {isMedia(image) ? (
            <Media
              media={image}
              variant={
                imageVariant ?? (ratio === "square" ? "square" : row ? "thumbnail" : "medium")
              }
              sizes={
                sizes ??
                (compact
                  ? "64px"
                  : row
                    ? "(max-width: 640px) 112px, 160px"
                    : "(max-width: 768px) 100vw, 400px")
              }
              preload={preload}
              loading={loading}
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
          {/* The rank sits on the picture's corner, so it costs the title no width. */}
          {rank != null && (
            <span className="bg-background text-foreground font-display absolute top-0 left-0 flex size-7 items-center justify-center rounded-br-sm text-2xl leading-none tabular-nums">
              {rank}
            </span>
          )}
        </div>
      )}
      <div className={cn("min-w-0 flex-1 space-y-1", layout === "split" && "md:basis-1/2")}>
        {!compact && kicker && (
          <p className="text-brand-text font-serif text-sm font-bold tracking-wider uppercase">
            {kicker}
          </p>
        )}
        <h3 className={cn(titleVariants({ layout, titleSize, density }))}>
          <HoverPrefetchLink href={href} className="after:absolute after:inset-0">
            {title}
          </HoverPrefetchLink>
        </h3>
        {!compact && summary && (
          <p
            className={cn(
              "font-serif",
              row
                ? "text-muted-foreground line-clamp-1 text-sm max-sm:hidden"
                : "text-foreground line-clamp-4 text-base leading-tight",
            )}
          >
            {summary}
          </p>
        )}
        {!compact && byline && (
          <div className="relative z-10 overflow-hidden text-sm whitespace-nowrap">{byline}</div>
        )}
        {!compact && meta && <p className="text-muted-foreground text-xs">{meta}</p>}
        {!compact && date}
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
