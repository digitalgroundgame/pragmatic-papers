"use client"

import { MediaBlock } from "@/blocks/MediaBlock/Component"
import { LightboxMediaBlock } from "@/blocks/MediaBlock/LightboxMediaBlock"
import {
  Carousel,
  CarouselContent,
  CarouselIndicators,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel"
import type { Media as MediaType } from "@/payload-types"
import React, { useState } from "react"

// Each slide is a 16:9 box. Every wrapper between the slide and the image takes
// the slide's full size and centres what it holds, and the frame is a size
// container the image measures itself against: as wide as the slide, or as wide
// as fits the slide's height at the image's own aspect ratio, whichever is
// narrower. The width comes from the media's dimensions rather than the loaded
// file, so the image holds its place (and its blur placeholder) before it loads,
// and its border hugs the picture rather than the slide.
const frameClassName =
  "not-prose flex h-full w-full items-center justify-center [container-type:size]"
const imgClassName = "h-auto max-w-full"

function fitToSlide({ width, height }: MediaType): React.CSSProperties {
  return { width: `min(100cqw, calc(100cqh * ${width || 16} / ${height || 9}))` }
}

interface MediaCarouselProps {
  images: { media: MediaType; id?: string | null }[]
  initialIndex?: number
  showCaptions?: boolean
  enableModal?: boolean
}

export const MediaCarousel: React.FC<MediaCarouselProps> = ({
  images,
  initialIndex = 0,
  enableModal = false,
}) => {
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(initialIndex)

  React.useEffect(() => {
    if (!api) {
      return
    }

    if (initialIndex > 0) {
      api.scrollTo(initialIndex, true)
    }

    React.startTransition(() => setCurrent(api.selectedScrollSnap()))

    const handleSelect = () => setCurrent(api.selectedScrollSnap())
    api.on("select", handleSelect)
    return () => {
      api.off("select", handleSelect)
    }
  }, [api, initialIndex])

  const validImages = images.filter((img) => img !== null)

  if (!validImages.length) return null

  return (
    <Carousel
      setApi={setApi}
      opts={{ loop: true, startIndex: initialIndex }}
      className="lg:-mx-8 xl:-mx-16"
    >
      <CarouselContent>
        {validImages.map(({ media, id }, index) => (
          <CarouselItem
            key={`${id}-${index}`}
            className="flex aspect-video w-full items-center justify-center"
          >
            {enableModal ? (
              <LightboxMediaBlock
                media={media}
                enableGutter={false}
                containerClassName="h-full"
                className={frameClassName}
                triggerClassName="flex h-full items-center justify-center"
                imgClassName={imgClassName}
                imgStyle={fitToSlide(media)}
                captionClassName="hidden"
              />
            ) : (
              <MediaBlock
                media={media}
                enableGutter={false}
                className={frameClassName}
                imgClassName={imgClassName}
                imgStyle={fitToSlide(media)}
                captionClassName="hidden"
              />
            )}
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselIndicators count={validImages.length} current={current} />
      <CarouselPrevious className="left-3 lg:-left-12" />
      <CarouselNext className="right-3 lg:-right-12" />
    </Carousel>
  )
}
