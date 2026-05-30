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
                className="not-prose h-full w-full"
                imgClassName="object-contain"
                captionClassName="hidden"
              />
            ) : (
              <MediaBlock
                media={media}
                enableGutter={false}
                className="not-prose h-full w-full"
                imgClassName="object-contain"
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
