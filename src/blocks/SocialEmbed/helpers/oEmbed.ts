/**
 * oEmbed TypeScript types based on https://oembed.com/#section2 (oEmbed 1.0)
 */

/**
 * The format of the oEmbed response.
 */
export type OEmbedFormat = "json" | "xml"

/**
 * The type of the oEmbed resource.
 */
export type OEmbedResourceType = "photo" | "video" | "link" | "rich"

/**
 * Consumer request query parameters (spec-defined).
 * Query params are ultimately serialized to strings; this is an ergonomic shape.
 */
export interface OEmbedRequestQuery {
  url: string
  maxwidth?: number
  maxheight?: number
  format?: OEmbedFormat

  // Providers may support custom parameters.
  // [customParam: string]: string | number | undefined
}

/**
 * Thumbnail dependency rule from the spec:
 * if any thumbnail_* is present, all three must be present.
 */
export interface OEmbedThumbnail {
  thumbnail_url: string
  thumbnail_width: number
  thumbnail_height: number
}

/**
 * Common response parameters valid for all response types.
 * Includes an index signature because providers may add fields not in the spec.
 */
export interface OEmbedBase {
  type: OEmbedResourceType
  version: "1.0"

  title?: string
  author_name?: string
  author_url?: string
  provider_name?: string
  provider_url?: string
  cache_age?: number
}

export interface OEmbedPhoto extends OEmbedBase {
  type: "photo"
  url: string
  width: number
  height: number
}

export interface OEmbedVideo extends OEmbedBase {
  type: "video"
  html: string
  width: number
  height: number
}

export interface OEmbedRich extends OEmbedBase {
  type: "rich"
  html: string
  width: number
  height: number
}

export interface OEmbedLink extends OEmbedBase {
  type: "link"
}

export type OEmbedResponse = OEmbedPhoto | OEmbedVideo | OEmbedRich | OEmbedLink

export const isOEmbedPhoto = (x: OEmbedResponse): x is OEmbedPhoto => x.type === "photo"
export const isOEmbedVideo = (x: OEmbedResponse): x is OEmbedVideo =>
  x.type === "video" && typeof x.html === "string"
export const isOEmbedRich = (x: OEmbedResponse): x is OEmbedRich =>
  x.type === "rich" && typeof x.html === "string"
export const isOEmbedLink = (x: OEmbedResponse): x is OEmbedLink => x.type === "link"
export const isOEmbed = (x: unknown): x is OEmbedResponse =>
  typeof x === "object" &&
  x !== null &&
  (isOEmbedPhoto(x as OEmbedPhoto) ||
    isOEmbedVideo(x as OEmbedVideo) ||
    isOEmbedRich(x as OEmbedRich) ||
    isOEmbedLink(x as OEmbedLink))
export const isOEmbedThumbnail = (
  x: OEmbedResponse | (OEmbedResponse & OEmbedThumbnail),
): x is OEmbedResponse & OEmbedThumbnail => {
  return "thumbnail_url" in x && "thumbnail_width" in x && "thumbnail_height" in x
}
