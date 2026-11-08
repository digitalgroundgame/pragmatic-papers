/** @jsxImportSource @/blocks/blockImages/svg */
import { BLOCKS } from "@/blocks/registry"

import { BACKDROP, type BlockPicker, Glyph } from "./shapes"
import type { Markup } from "./svg/jsx-runtime"

export const THUMBNAIL_WIDTH = 480
export const THUMBNAIL_HEIGHT = 320

/**
 * A mid grey, at Lucide's own stroke width, so the icons sit with the menu's built-in ones.
 * An image can't inherit the text color as `currentColor` would, so it has to read on both
 * themes: about 4:1 against the light menu and 5:1 against the dark one.
 */
const ICON_COLOR = "#808080"

const Thumbnail = ({ picker }: { picker: BlockPicker }): Markup => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox={`0 0 ${THUMBNAIL_WIDTH} ${THUMBNAIL_HEIGHT}`}
    width={THUMBNAIL_WIDTH}
    height={THUMBNAIL_HEIGHT}
    fill="none"
  >
    <rect width={THUMBNAIL_WIDTH} height={THUMBNAIL_HEIGHT} rx={24} fill={BACKDROP} />
    {picker.thumbnail}
  </svg>
)

/**
 * Every picker image, by file name: `<slug>.svg` (the thumbnail) and `<slug>-icon.svg` for
 * each block in `BLOCKS`, loading the `picker` its descriptor names. The
 * `/admin/block-images/[file]` route serves them.
 */
export async function renderBlockImages(): Promise<Record<string, string>> {
  const files: Record<string, string> = {}
  for (const { slug, picker: load } of BLOCKS) {
    if (!load) continue
    const picker = await load()
    files[`${slug}.svg`] = String(<Thumbnail picker={picker} />)
    files[`${slug}-icon.svg`] = String(<Glyph icon={picker.icon} color={ICON_COLOR} />)
  }
  return files
}
