import type { Media as MediaType } from "@/payload-types"

export type VideoMediaType = MediaType & { mimeType: `video/${string}` }
export type ImageMediaType = MediaType & { mimeType: `image/${string}` }
export type AudioMediaType = MediaType & { mimeType: `audio/${string}` }

// VideoMediaType/ImageMediaType/AudioMediaType are all `MediaType & { mimeType }`,
// so the base type covers every narrowed variant the guards below produce.
export type MediaTypes = MediaType | number | null | undefined

export function isVideoMedia(media: MediaTypes): media is VideoMediaType {
  if (!media || typeof media === "number") return false
  return media.mimeType?.startsWith("video") ?? false
}

export function isAudioMedia(media: MediaTypes): media is AudioMediaType {
  if (!media || typeof media === "number") return false
  return media.mimeType?.startsWith("audio") ?? false
}

export function isImageMedia(media: MediaTypes): media is ImageMediaType {
  if (!media || typeof media === "number") return false
  return media.mimeType?.startsWith("image") ?? false
}

export function isMedia(media: MediaTypes): media is MediaType {
  if (!media) return false
  if (typeof media === "number") return false
  return true
}
