// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"

import configPromise from "@payload-config"
import type { SanitizedConfig } from "payload"
import { beforeAll, describe, expect, it } from "vitest"

import { blockIconURL, blockImages, blockThumbnailURL } from ".."
import { BLOCK_ART } from "../art"
import { renderBlockImages } from "../render"

const PUBLIC = resolve(__dirname, "../../../../public")
const IMAGES_DIR = join(PUBLIC, "block-images")

// The slice of Payload's sanitized config this test reads.
interface ResolvedImage {
  alt?: string
  url: string
}
interface ResolvedBlock {
  slug: string
  admin?: { images?: { icon?: ResolvedImage | string; thumbnail?: ResolvedImage | string } }
  fields?: ResolvedField[]
  flattenedFields?: ResolvedField[]
}
interface ResolvedField {
  type: string
  fields?: ResolvedField[]
  flattenedFields?: ResolvedField[]
  blocks?: ResolvedBlock[]
  editor?: {
    editorConfig?: {
      resolvedFeatureMap?: Map<
        string,
        {
          sanitizedServerFeatureProps?: { blocks?: ResolvedBlock[]; inlineBlocks?: ResolvedBlock[] }
        }
      >
    }
  }
}

const fieldsOf = (item: { fields?: ResolvedField[]; flattenedFields?: ResolvedField[] }) =>
  item.flattenedFields ?? item.fields ?? []

/** Every block an editor can add: page layouts, and rich text's blocks and inline blocks, nested too. */
const collectBlocks = (fields: ResolvedField[], found: Map<string, ResolvedBlock>): void => {
  for (const field of fields) {
    const features =
      field.type === "richText" ? field.editor?.editorConfig?.resolvedFeatureMap : undefined
    const { blocks = [], inlineBlocks = [] } =
      features?.get("blocks")?.sanitizedServerFeatureProps ?? {}
    const nested = [...blocks, ...inlineBlocks, ...(field.blocks ?? [])]
    const unseen = nested.filter(({ slug }) => !found.has(slug))
    unseen.forEach((block) => found.set(block.slug, block))
    collectBlocks([...fieldsOf(field), ...unseen.flatMap(fieldsOf)], found)
  }
}

const urlOf = (image: ResolvedImage | string | undefined) =>
  typeof image === "string" ? image : image?.url

describe("block picker images", () => {
  const blocks = new Map<string, ResolvedBlock>()

  beforeAll(async () => {
    const config: SanitizedConfig = await configPromise
    // Hidden collections (the form builder's, until it's set up) have no picker to show.
    const shown = [...config.collections, ...config.globals].filter(
      (entity) => entity.admin?.hidden !== true,
    )
    for (const entity of shown) {
      collectBlocks(entity.flattenedFields as ResolvedField[], blocks)
    }
  }, 60_000)

  it("finds the blocks in the config", () => {
    // Guards the traversal itself: an empty map would make every check below pass.
    expect(blocks.size).toBeGreaterThan(10)
    expect([...blocks.keys()]).toEqual(expect.arrayContaining(["banner", "footnote", "content"]))
  })

  it("gives every block a thumbnail and an icon", () => {
    const missing = [...blocks.values()]
      .filter(({ slug, admin }) => {
        const images = admin?.images
        return (
          urlOf(images?.thumbnail) !== blockThumbnailURL(slug) ||
          urlOf(images?.icon) !== blockIconURL(slug)
        )
      })
      .map(({ slug }) => slug)
    expect(missing, 'add `admin: { images: blockImages("<slug>") }` to these blocks').toEqual([])
  })

  it("draws art for every block, and none for blocks that are gone", () => {
    expect(Object.keys(BLOCK_ART).sort()).toEqual([...blocks.keys()].sort())
  })

  it("points every block's images at files in public/", () => {
    const missing = [...blocks.keys()]
      .flatMap((slug) => Object.values(blockImages(slug)))
      .filter(({ url }) => !existsSync(join(PUBLIC, url)))
      .map(({ url }) => url)
    expect(missing, "run `pnpm block-images`").toEqual([])
  })
})

describe("public/block-images", () => {
  const files = renderBlockImages()

  it("matches the art", () => {
    const onDisk = Object.fromEntries(
      readdirSync(IMAGES_DIR).map((name) => [name, readFileSync(join(IMAGES_DIR, name), "utf8")]),
    )
    expect(onDisk, "run `pnpm block-images`").toEqual(files)
  })

  it.each(Object.keys(BLOCK_ART))("draws %s at the sizes Payload expects", (slug) => {
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
