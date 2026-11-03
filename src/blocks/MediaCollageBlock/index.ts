import { GalleryHorizontalEndIcon, ImagesIcon } from "lucide-react"

import type { LexicalNode } from "@/blocks/feed/types"
import { defineBlock } from "@/blocks/types"
import type { MediaCollageBlock } from "@/payload-types"
import { describeVisual } from "@/utilities/describeVisual"

import { mediaCollageToHTML } from "./converters"

type StoredImage = { media?: unknown } | null | undefined

const imagesOf = (value: unknown): StoredImage[] => (Array.isArray(value) ? value : [])

export const mediaCollageBlock = defineBlock<MediaCollageBlock>({
  slug: "mediaCollage",
  html: mediaCollageToHTML,
  narrate: (fields, { describeMedia }) => {
    const descriptions = imagesOf(fields.images)
      .map((image) => (image && typeof image === "object" && image.media ? image.media : null))
      .filter(Boolean)
      .map(describeMedia)
      .filter(Boolean)
    return describeVisual("a gallery of images", descriptions.join("; "))
  },
  // One page per image, each shown as a media block.
  readingFeed: {
    placement: "split",
    durationMs: 8000,
    split: (node) => {
      const fields = node.fields as { images?: StoredImage[] } | undefined
      return imagesOf(fields?.images)
        .filter((image): image is { media: unknown } => Boolean(image?.media))
        .map<LexicalNode>((image) => ({
          type: "block",
          version: 1,
          fields: { blockType: "mediaBlock", media: image.media },
        }))
    },
  },
  tableOfContents: ({ images, layout }) => {
    if (!images?.length) return null
    return layout === "carousel"
      ? { label: "Carousel", icon: GalleryHorizontalEndIcon }
      : { label: "Image grid", icon: ImagesIcon }
  },
  media: {
    find: (block) => imagesOf(block.images).map((image) => image?.media),
    // A collage drops the image, and goes too if it was the last one: it needs an image.
    detach: (block, uses) => {
      const images = imagesOf(block.images)
      const remaining = images.filter((image) => !uses(image?.media))
      if (remaining.length === images.length) return block
      return remaining.length === 0 ? null : { ...block, images: remaining }
    },
  },
})
