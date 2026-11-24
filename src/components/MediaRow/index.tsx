import React from "react"

import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import { Media, isMedia } from "@/components/Media"
import type { Media as MediaType } from "@/payload-types"
import { cn } from "@/utilities/utils"

/**
 * PROTOTYPE: the one compact card. No border, no padding box: a small thumbnail, the title,
 * a line of summary and a meta line, with a hairline between rows (`divide-y` on the list).
 * The whole row is one link and reacts as one (`group/card`, `card-hover:`).
 */
export function MediaRow({
  href,
  title,
  summary,
  meta,
  image,
  className,
}: {
  href: string
  title: React.ReactNode
  summary?: string | null
  meta?: React.ReactNode
  image?: MediaType | number | null
  className?: string
}): React.ReactNode {
  return (
    <HoverPrefetchLink href={href} className={cn("group/card flex gap-4 py-4", className)}>
      {isMedia(image) && (
        <Media
          media={image}
          variant="thumbnail"
          sizes="96px"
          className="card-hover:brightness-[1.02] card-hover:contrast-[1.16] card-hover:saturate-[1.16] aspect-3/2 w-24 shrink-0 rounded-sm object-cover transition-[filter] duration-300 ease-out"
        />
      )}
      <div className="min-w-0 space-y-1">
        <h3 className="card-hover:text-foreground/80 mt-0! line-clamp-2 text-lg leading-tight text-pretty md:text-xl">
          {title}
        </h3>
        {summary && (
          <p className="text-muted-foreground line-clamp-2 font-serif text-sm">{summary}</p>
        )}
        {meta && <p className="text-muted-foreground text-xs">{meta}</p>}
      </div>
    </HoverPrefetchLink>
  )
}

/** Rows of `MediaRow`, a hairline between each; `columns` sets two side by side from md up. */
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
      className={cn(
        columns === 2 ? "grid gap-x-8 md:grid-cols-2 [&>*]:border-b" : "divide-y",
        className,
      )}
    >
      {children}
    </div>
  )
}
