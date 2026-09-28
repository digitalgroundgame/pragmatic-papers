import type { Media as MediaType } from "@/payload-types"
import { isResolved, type Relationship } from "@/utilities/relationships"

export type VideoMediaType = MediaType & { mimeType: `video/${string}` }
export type ImageMediaType = MediaType & { mimeType: `image/${string}` }
export type AudioMediaType = MediaType & { mimeType: `audio/${string}` }

// VideoMediaType/ImageMediaType/AudioMediaType are all `MediaType & { mimeType }`,
// so the base type covers every narrowed variant the guards below produce.
export type MediaTypes = Relationship<MediaType>

export function isMedia(media: MediaTypes): media is MediaType {
  return isResolved(media)
}

export function isVideoMedia(media: MediaTypes): media is VideoMediaType {
  return isMedia(media) && (media.mimeType?.startsWith("video") ?? false)
}

export function isAudioMedia(media: MediaTypes): media is AudioMediaType {
  return isMedia(media) && (media.mimeType?.startsWith("audio") ?? false)
}

export function isImageMedia(media: MediaTypes): media is ImageMediaType {
  return isMedia(media) && (media.mimeType?.startsWith("image") ?? false)
}
