import type { Media as MediaType } from "@/payload-types"
import { cn } from "@/utilities/utils"
import React from "react"
import { MediaBlock } from "./Component"

interface FullscreenMediaProps {
  media: MediaType
  /** Applied to the outer wrapper. */
  className?: string
}

// The "opened lightbox" presentation of a single piece of media —
// image scaled to viewport, caption in a scrollable footer underneath.
// Shared between the feed's mediaBlock FeedComponent and the
// LightboxMediaBlock dialog content so both surfaces look identical.
export const FullscreenMedia: React.FC<FullscreenMediaProps> = ({ media, className }) => {
  return (
    <div className={cn("flex h-full w-full flex-col items-center justify-center gap-3", className)}>
      <MediaBlock
        media={media}
        sizes="100vw"
        variant="xlarge"
        enableGutter={false}
        className="text-muted-foreground [&_a]:text-foreground flex w-full flex-col items-center gap-2"
        imgClassName="border max-h-[80dvh] w-auto max-w-full h-auto"
        captionClassName="max-h-24 overflow-y-auto px-4 text-center"
        disableInnerContainer
      />
    </div>
  )
}
