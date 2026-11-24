import type { CollectionGridSlots, Media as MediaType, User } from "@/payload-types"
import React from "react"

import { Byline } from "@/components/Authors/Byline"
import { toBylineAuthor } from "@/components/Authors/BylineAuthor"
import { isMedia } from "@/components/Media"
import { Tile } from "@/components/Tile"
import type { ImageVariant } from "@/components/Media/CMSImage"
import { TimeAgo } from "@/components/TimeAgo"
import { isResolved } from "@/utilities/relationships"
import { docPath } from "@/utilities/routes"

export type ImagePosition = "above" | "below" | "left" | "right" | "none"

export interface CollectionTileProps extends React.ComponentProps<"div"> {
  tile: CollectionGridSlots[number] | undefined
  imagePosition?: ImagePosition
  preload?: boolean
  loading?: "eager" | "lazy"
  sizes?: string
  variant?: ImageVariant
}

export const CollectionTile: React.FC<CollectionTileProps> = ({
  tile,
  imagePosition = "above",
  preload,
  loading,
  className,
  sizes = "(max-width: 768px) 100vw, 920px",
  variant = "medium",
}) => {
  if (!tile) return null
  const { id, collection, kicker, overrideTitle, showByline } = tile

  if (!collection || !isResolved(collection.value)) return null

  const { title, slug, publishedAt, meta } = collection.value
  const href = docPath(collection.relationTo, slug ?? "")

  let populatedAuthors: User[] = []
  let heroImage: MediaType | null = null
  if (imagePosition !== "none") {
    if (collection.relationTo === "articles" && isMedia(collection.value.heroImage)) {
      heroImage = collection.value.heroImage
    } else if (collection.value.meta?.image && isMedia(collection.value.meta.image)) {
      heroImage = collection.value.meta.image
    }
  }

  if ("authors" in collection.value && collection.value.authors) {
    populatedAuthors = collection.value.authors.filter(isResolved<User>)
  }

  const isHorizontal = imagePosition === "left" || imagePosition === "right"
  const authors = showByline ? populatedAuthors.map(toBylineAuthor) : []

  // The block's slot, mapped onto the site's one card. Above is a stacked tile, left and
  // right a split one, below a stacked one turned over; none drops the picture.
  return (
    <Tile
      id={id ?? undefined}
      className={className}
      href={href}
      title={overrideTitle || title}
      kicker={kicker}
      summary={meta?.description}
      byline={authors.length > 0 ? <Byline size="sm" authors={authors} /> : null}
      date={<TimeAgo publishedAt={publishedAt} />}
      image={heroImage}
      layout={isHorizontal ? "split" : "stacked"}
      imagePosition={
        imagePosition === "none"
          ? "none"
          : imagePosition === "right" || imagePosition === "below"
            ? "end"
            : "start"
      }
      ratio="video"
      titleSize="fluid"
      imageVariant={variant}
      sizes={sizes}
      preload={preload}
      loading={loading}
    />
  )
}
