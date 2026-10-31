import { renderToStaticMarkup } from "react-dom/server"

import { BLOCK_ART, Icon, Thumbnail } from "./art"

/**
 * Every file in `public/block-images/`, by name: `<slug>.svg` (the thumbnail) and
 * `<slug>-icon.svg` for each block in `BLOCK_ART`.
 */
export function renderBlockImages(): Record<string, string> {
  const files: Record<string, string> = {}
  for (const [slug, art] of Object.entries(BLOCK_ART)) {
    files[`${slug}.svg`] = `${renderToStaticMarkup(<Thumbnail art={art} />)}\n`
    files[`${slug}-icon.svg`] = `${renderToStaticMarkup(<Icon art={art} />)}\n`
  }
  return files
}
