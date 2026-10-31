/**
 * The pictures Payload shows for a block when an editor adds one: `thumbnail` in the
 * page layout's block drawer (3:2), `icon` in the rich-text editor's slash menu and
 * toolbar (20×20). Both are SVGs in `public/block-images/`, drawn in `art.tsx` and
 * written by `pnpm block-images`.
 *
 * They're decorative (the block's label sits beside each one), so their alt text is empty.
 */
export const BLOCK_IMAGES_PATH = "/block-images"

export const blockThumbnailURL = (slug: string): string => `${BLOCK_IMAGES_PATH}/${slug}.svg`
export const blockIconURL = (slug: string): string => `${BLOCK_IMAGES_PATH}/${slug}-icon.svg`

interface BlockImage {
  alt: string
  url: string
}

/** `admin.images` for the block with this slug. Its art must be in `BLOCK_ART`. */
export const blockImages = (slug: string): { icon: BlockImage; thumbnail: BlockImage } => ({
  icon: { url: blockIconURL(slug), alt: "" },
  thumbnail: { url: blockThumbnailURL(slug), alt: "" },
})
