import type { Article, CollectionGridSlots, Media as MediaType } from "@/payload-types"
import React from "react"

import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import { isMedia, Media } from "@/components/Media"
import type { ImageVariant } from "@/components/Media/ImageMedia"
import { TimeAgo } from "@/components/TimeAgo"
import { cn } from "@/utilities/utils"

export type ImagePosition = "above" | "below" | "left" | "right" | "none"

export interface CollectionTileProps extends React.ComponentProps<"div"> {
  tile: CollectionGridSlots[number]
  imagePosition?: ImagePosition
  priority?: boolean
  loading?: "eager" | "lazy"
  sizes?: string
  variant?: ImageVariant
}

export const CollectionTile: React.FC<CollectionTileProps> = ({
  tile,
  imagePosition = "above",
  priority,
  loading,
  className,
  sizes = "(max-width: 768px) 100vw, 920px",
  variant = "medium",
}) => {
  if (!tile) return null
  const { id, collection, kicker, overrideTitle, showByline } = tile

  if (!collection || typeof collection.value === "number") return null

  const { title, slug, publishedAt, meta } = collection.value
  const href = `/${collection.relationTo}/${slug}`

  let populatedAuthors: Article["populatedAuthors"] = []
  let heroImage: MediaType | null = null
  if (imagePosition !== "none") {
    if (collection.relationTo === "articles" && isMedia(collection.value.heroImage)) {
      heroImage = collection.value.heroImage
    } else if (collection.value.meta?.image && isMedia(collection.value.meta.image)) {
      heroImage = collection.value.meta.image
    }
  }

  if ("populatedAuthors" in collection.value) {
    populatedAuthors = collection.value.populatedAuthors ?? []
  }

  const isHorizontal = imagePosition === "left" || imagePosition === "right"

  // Volume authors are not supported for the byline at this time
  const authorNames =
    populatedAuthors
      ?.map((a) => a.name)
      .filter((a) => Boolean(a))
      .join(", ") ?? null

  return (
    <HoverPrefetchLink
      href={href}
      id={id ?? undefined}
      className={cn(
        "group @container flex flex-col gap-x-6 gap-y-2",
        isHorizontal && "flex-col items-start md:flex-row",
        className,
      )}
    >
      {heroImage && (
        <div
          className={cn(
            "aspect-video w-full overflow-hidden rounded-sm border",
            isHorizontal ? "md:basis-1/2" : "shrink",
            imagePosition === "left" && "md:order-first",
            imagePosition === "right" && "md:order-last",
          )}
        >
          <Media
            media={heroImage}
            className="h-full w-full object-cover object-center hover:opacity-80"
            variant={variant}
            sizes={sizes}
            priority={priority}
            loading={loading}
          />
        </div>
      )}
      <div
        className={cn(
          isHorizontal && "@container flex flex-col justify-center self-stretch md:basis-1/2",
        )}
      >
        {/* Kicker */}
        {kicker && (
          <p className="text-brand font-serif text-sm font-bold tracking-wider uppercase">
            {kicker}
          </p>
        )}

        {/* Title — uses container queries to scale with available space */}
        <h2 className="text-primary hover:text-primary/80 text-2xl text-balance @xs:text-2xl @sm:text-3xl @md:text-4xl @lg:text-5xl">
          {overrideTitle || title}
        </h2>

        {/* Byline */}
        {showByline && authorNames && (
          <p className="text-muted-foreground mt-1 line-clamp-1 font-sans text-sm">{authorNames}</p>
        )}

        {/* Description */}
        {meta?.description && (
          <p className="text-primary mt-1 line-clamp-4 font-serif text-base leading-tight">
            {meta!.description}
          </p>
        )}

        <TimeAgo publishedAt={publishedAt} />
      </div>
    </HoverPrefetchLink>
  )
}
