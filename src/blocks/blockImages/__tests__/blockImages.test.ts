// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"

import { describe, expect, it } from "vitest"

import { blockImages } from ".."
import { PICKERS } from "../pickers"
import { renderBlockImages } from "../render"

// Whether every block has images is `registry.test.ts`'s check; this one checks the files.
const IMAGES_DIR = resolve(__dirname, "../../../../public/block-images")

describe("public/block-images", () => {
  const files = renderBlockImages()

  it("matches what each block's picker.tsx draws", () => {
    const onDisk = Object.fromEntries(
      readdirSync(IMAGES_DIR).map((name) => [name, readFileSync(join(IMAGES_DIR, name), "utf8")]),
    )
    expect(onDisk, "run `pnpm block-images`").toEqual(files)
  })

  it.each(Object.keys(PICKERS))("draws %s at the sizes Payload expects", (slug) => {
    // The drawer wants 3:2 thumbnails; the editor's menus show icons at 20×20.
    expect(files[`${slug}.svg`]).toContain('viewBox="0 0 480 320"')
    expect(files[`${slug}-icon.svg`]).toContain('viewBox="0 0 24 24"')
  })

  it("marks the images decorative, since the block's label sits beside each", () => {
    expect(blockImages("banner")).toEqual({
      icon: { url: "/block-images/banner-icon.svg", alt: "" },
      thumbnail: { url: "/block-images/banner.svg", alt: "" },
    })
  })
})
