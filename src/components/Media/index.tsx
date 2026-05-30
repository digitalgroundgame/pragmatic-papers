import type { Media as MediaType } from "@/payload-types"
import React from "react"

import { AudioMedia, type AudioMediaProps } from "./AudioMedia"
import { ImageMedia, type ImageMediaProps } from "./ImageMedia"
import { VideoMedia, type VideoMediaProps } from "./VideoMedia"

type MediaTypes =
  | VideoMediaProps
  | ImageMediaProps
  | AudioMediaProps
  | { media?: MediaType | number | null }

export function isVideoMedia(props: MediaTypes): props is VideoMediaProps {
  if (!props.media || typeof props.media === "number") return false
  return props.media.mimeType?.startsWith("video") ?? false
}

export function isAudioMedia(props: MediaTypes): props is AudioMediaProps {
  if (!props.media || typeof props.media === "number") return false
  return props.media.mimeType?.startsWith("audio") ?? false
}

export function isImageMedia(props: MediaTypes): props is ImageMediaProps {
  if (!props.media || typeof props.media === "number") return false
  return props.media.mimeType?.startsWith("image") ?? false
}

export function isMedia(media: number | MediaType | undefined | null): media is MediaType {
  if (!media) return false
  if (typeof media === "number") return false
  return true
}

export const Media: React.FC<MediaTypes> = (props) => {
  if (isVideoMedia(props)) {
    return <VideoMedia {...props} />
  }

  if (isAudioMedia(props)) {
    return <AudioMedia {...props} />
  }

  if (isImageMedia(props)) {
    return <ImageMedia {...props} />
  }

  return null
}
