"use client"
import { MediaCarousel } from "@/components/MediaCarousel"
import type {
  MediaCollageBlock as MediaCollageBlockType,
  Media as MediaType,
} from "@/payload-types"
import { cn } from "@/utilities/utils"
import React from "react"
import { LightboxMediaBlock } from "../MediaBlock/LightboxMediaBlock"

export const MediaCollageBlock: React.FC<MediaCollageBlockType> = (props) => {
  const { layout } = props

  const images = (props.images ?? []).filter(
    (img): img is { media: MediaType; id?: string | null } =>
      typeof img.media !== "number" && !!img.media,
  )

  if (!images.length) return null

  if (layout === "carousel") {
    return <MediaCarousel images={images} showCaptions enableModal />
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 lg:-mx-8 xl:-mx-16">
      {images.map(({ media, id }, idx) => {
        const isLastOddItem = images.length % 2 !== 0 && idx === images.length - 1
        return (
          <LightboxMediaBlock
            key={`${id}-${idx}`}
            media={media}
            containerClassName={cn(isLastOddItem && "mx-auto md:col-span-2 w-1/2")}
            className="my-0! [&>figcaption]:hidden"
            sizes="(max-width: 768px) 100vw, (max-width: 1376px) 50vw, 688px"
          />
        )
      })}
    </div>
  )
}
