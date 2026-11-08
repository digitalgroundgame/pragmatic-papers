import type { ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { PICKERS } from "./pickers"
import { BACKDROP, BRAND, type BlockPicker } from "./shapes"

export const THUMBNAIL_WIDTH = 480
export const THUMBNAIL_HEIGHT = 320
export const ICON_SIZE = 24

const Thumbnail = ({ picker }: { picker: BlockPicker }): ReactElement => (
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

const Icon = ({ picker }: { picker: BlockPicker }): ReactElement => {
  const Glyph = picker.icon
  return (
    <Glyph xmlns="http://www.w3.org/2000/svg" size={ICON_SIZE} color={BRAND} strokeWidth={2.25} />
  )
}

/**
 * Every file in `public/block-images/`, by name: `<slug>.svg` (the thumbnail) and
 * `<slug>-icon.svg` for each block in `PICKERS`.
 */
export function renderBlockImages(): Record<string, string> {
  const files: Record<string, string> = {}
  for (const [slug, picker] of Object.entries(PICKERS)) {
    files[`${slug}.svg`] = `${renderToStaticMarkup(<Thumbnail picker={picker} />)}\n`
    files[`${slug}-icon.svg`] = `${renderToStaticMarkup(<Icon picker={picker} />)}\n`
  }
  return files
}
