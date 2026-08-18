import type { Media as MediaType } from "@/payload-types"
import NextImage, { type ImageProps } from "next/image"
import React from "react"

import { getMediaUrl } from "@/utilities/getMediaUrl"
import { cn } from "@/utilities/utils"

export type ImageVariant = keyof Required<MediaType>["sizes"]

export interface ImageMediaProps extends Omit<ImageProps, "src" | "alt" | "width" | "height"> {
  media: MediaType & { mimeType: `image/${string}` }
  variant?: ImageVariant
  containerClassName?: string
}

function getMediaByVariant(
  media: MediaType,
  variant: ImageVariant,
): Required<MediaType>["sizes"][ImageVariant] {
  return media.sizes?.[variant]
}

/**
 * ImageMedia
 * TODO: Rename ImageMedia to `CMSImage`
 *
 * Locally-stored media (Payload local storage) has relative URLs like `/api/media/file/...`.
 * getMediaUrl() passes these through as-is so next/image handles them internally — no upstream
 * HTTP fetch, no private-IP SSRF block. External CDN URLs (Supabase, S3) are absolute and must
 * be allowed via remotePatterns in next.config.ts.
 */
export const ImageMedia: React.FC<ImageMediaProps> = ({
  media,
  variant,
  sizes,
  className,
  quality = 80,
  priority, // TODO rename to `preload` after upgrading to Next.js 16
  loading,
  fill,
  style,
  ...props
}) => {
  if (!media.url) return null
  let src = getMediaUrl(media.url, media.updatedAt)
  const alt = media.alt || "" // TODO: alt should be required
  let width = media.width ?? undefined
  let height = media.height ?? undefined
  // Blur only over a preview derived from this image. Uploads get one from the
  // `generateBlurDataUrl` hook; media we never held the bytes for — a remote
  // image shaped into a `Media`, as the Merch block does — has none, and a
  // stand-in blob would be a picture of something else entirely. It would also
  // be a fixed colour, which flashes wrong in one of the two themes and shows
  // straight through a transparent PNG. With no placeholder, whatever the
  // layout puts behind the image shows instead — a themed `bg-*` on the
  // container, in our cases, which is correct in both themes for free.
  const blurDataURL = media.blurDataURL ?? undefined
  loading = priority !== undefined ? undefined : loading // loading and priority are mutually exclusive

  if (variant) {
    const mediaBySize = getMediaByVariant(media, variant)
    src = getMediaUrl(mediaBySize?.url, media.updatedAt) || src
    width = mediaBySize?.width || width
    height = mediaBySize?.height || height
  }

  if (fill) {
    width = undefined
    height = undefined
  }

  const objectPosition =
    media.focalX != null && media.focalY != null ? `${media.focalX}% ${media.focalY}%` : undefined

  style = objectPosition ? { ...style, objectPosition } : style

  return (
    <NextImage
      {...props}
      style={style}
      className={cn("rounded-sm", className)}
      src={src}
      alt={alt}
      width={width}
      height={height}
      fill={fill}
      sizes={sizes}
      quality={quality}
      priority={priority}
      fetchPriority={priority ? "high" : undefined}
      loading={loading}
      placeholder={blurDataURL ? "blur" : "empty"}
      blurDataURL={blurDataURL}
    />
  )
}
