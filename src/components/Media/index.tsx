import type { Media as MediaType } from "@/payload-types"
import React from "react"

import { AudioMedia, type AudioMediaProps } from "./AudioMedia"
import { ImageMedia, type ImageMediaProps } from "./ImageMedia"
import { isAudioMedia, isImageMedia, isVideoMedia } from "./types"
import { VideoMedia, type VideoMediaProps } from "./VideoMedia"

export * from "./types"

type MediaPropsTypes =
  | VideoMediaProps
  | ImageMediaProps
  | AudioMediaProps
  | { media?: MediaType | number | null }

// Narrowing `props.media` doesn't narrow `props` itself — mimeType is a template
// literal, not a discriminant — so the guards are lifted to the props object.
function isVideoMediaProps(props: MediaPropsTypes): props is VideoMediaProps {
  return isVideoMedia(props.media)
}

function isAudioMediaProps(props: MediaPropsTypes): props is AudioMediaProps {
  return isAudioMedia(props.media)
}

function isImageMediaProps(props: MediaPropsTypes): props is ImageMediaProps {
  return isImageMedia(props.media)
}

export const Media: React.FC<MediaPropsTypes> = (props) => {
  if (isVideoMediaProps(props)) {
    return <VideoMedia {...props} />
  }

  if (isAudioMediaProps(props)) {
    return <AudioMedia {...props} />
  }

  if (isImageMediaProps(props)) {
    return <ImageMedia {...props} />
  }

  return null
}
