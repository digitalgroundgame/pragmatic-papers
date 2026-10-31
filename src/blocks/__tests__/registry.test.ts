// @vitest-environment node
import configPromise from "@payload-config"
import type { SanitizedConfig } from "payload"
import { beforeAll, describe, expect, it, vi } from "vitest"

import { BLOCKS, blockDescriptor } from "@/blocks/registry"

vi.mock("server-only", () => ({}))

const { jsxConverters } = await import("@/components/RichText")
const { LAYOUT_BLOCK_TYPES } = await import("@/blocks/RenderBlocks")

// The slice of Payload's sanitized config this test reads.
interface ResolvedBlock {
  slug: string
  fields?: ResolvedField[]
  flattenedFields?: ResolvedField[]
}
interface ResolvedField {
  name?: string
  type: string
  relationTo?: string | string[]
  fields?: ResolvedField[]
  flattenedFields?: ResolvedField[]
  blocks?: ResolvedBlock[]
  tabs?: { fields?: ResolvedField[] }[]
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

/** The blocks a rich text or `blocks` field offers directly, not those nested in them. */
function blocksIn(field: ResolvedField): { blocks: ResolvedBlock[]; inline: ResolvedBlock[] } {
  if (field.type === "blocks") return { blocks: field.blocks ?? [], inline: [] }
  if (field.type !== "richText") return { blocks: [], inline: [] }
  const props =
    field.editor?.editorConfig?.resolvedFeatureMap?.get("blocks")?.sanitizedServerFeatureProps
  return { blocks: props?.blocks ?? [], inline: props?.inlineBlocks ?? [] }
}

/** Every rich text and `blocks` field under `fields`, nested ones included. */
function editorsUnder(fields: ResolvedField[]): ResolvedField[] {
  return fields.flatMap((field) => {
    const { blocks, inline } = blocksIn(field)
    const nested = [
      ...fieldsOf(field),
      ...(field.tabs ?? []).flatMap((tab) => tab.fields ?? []),
      ...[...blocks, ...inline].flatMap(fieldsOf),
    ]
    const own = blocks.length || inline.length ? [field] : []
    return [...own, ...editorsUnder(nested)]
  })
}

/** Whether a block's own fields (not its nested rich text) hold an upload of media. */
function holdsMedia(fields: ResolvedField[]): boolean {
  return fields.some((field) => {
    const relationTo = [field.relationTo ?? []].flat()
    if (field.type === "upload" && relationTo.includes("media")) return true
    if (field.type === "richText" || field.type === "blocks") return false
    return holdsMedia([...fieldsOf(field), ...(field.tabs ?? []).flatMap((t) => t.fields ?? [])])
  })
}

interface Editor {
  name: string
  blocks: ResolvedBlock[]
  inline: ResolvedBlock[]
}

/** The blocks an editor offers, with the rich text and blocks nested inside them. */
function editorAt(config: SanitizedConfig, collection: string, path: string): Editor {
  const found = config.collections.find(({ slug }) => slug === collection)
  const field = (found?.flattenedFields as ResolvedField[] | undefined)?.find(
    ({ name }) => name === path,
  )
  if (!field) throw new Error(`${collection}.${path} not found in the config`)
  const editors = editorsUnder([field])
  return {
    name: `${collection}.${path}`,
    blocks: editors.flatMap((editor) => blocksIn(editor).blocks),
    inline: editors.flatMap((editor) => blocksIn(editor).inline),
  }
}

/** The editors whose content reaches each output, and what each output needs of a block. */
const OUTPUTS = {
  /** RSS: articles' content and volumes' editor's notes. Substack falls back to `html`. */
  html: [
    ["articles", "content"],
    ["volumes", "editorsNote"],
  ],
  /** The article's voice-over. */
  narrate: [["articles", "content"]],
} as const

const RICH_TEXT_EDITORS = [
  ["articles", "content"],
  ["volumes", "editorsNote"],
  ["docs", "content"],
  ["pages", "layout"],
] as const

const slugs = (blocks: ResolvedBlock[]) => [...new Set(blocks.map(({ slug }) => slug))].sort()

let config: SanitizedConfig
const editors = new Map<string, Editor>()
const editor = (collection: string, path: string) => editors.get(`${collection}.${path}`)!

beforeAll(async () => {
  config = await configPromise
  for (const [collection, path] of RICH_TEXT_EDITORS) {
    editors.set(`${collection}.${path}`, editorAt(config, collection, path))
  }
}, 60_000)

describe("the block registry", () => {
  it("finds the editors' blocks in the config", () => {
    // Guards the traversal itself: an empty list would make every check below pass.
    expect(editor("articles", "content").blocks.length).toBeGreaterThan(5)
    expect(editor("articles", "content").inline.length).toBeGreaterThan(0)
    expect(editor("pages", "layout").blocks.length).toBeGreaterThan(5)
  })

  it("has a descriptor for every block an editor offers", () => {
    const offered = [...editors.values()].flatMap((e) => [...e.blocks, ...e.inline])
    const missing = slugs(offered).filter((slug) => !blockDescriptor(slug))
    expect(missing, "add a descriptor to src/blocks/registry.ts for these blocks").toEqual([])
  })

  it("lists each slug once, and only slugs an editor offers", () => {
    const listed = BLOCKS.map(({ slug }) => slug)
    expect(new Set(listed).size).toBe(listed.length)
    const offered = new Set(
      [...editors.values()].flatMap((e) => [...e.blocks, ...e.inline]).map(({ slug }) => slug),
    )
    expect(listed.filter((slug) => !offered.has(slug))).toEqual([])
  })

  it("marks inline blocks as inline, and only them", () => {
    for (const e of editors.values()) {
      for (const { slug } of e.inline) expect(blockDescriptor(slug)?.inline, slug).toBe(true)
      for (const { slug } of e.blocks) expect(blockDescriptor(slug)?.inline, slug).toBeFalsy()
    }
  })

  it.each(Object.entries(OUTPUTS))(
    "declares %s for every block whose editor needs it",
    (output, targets) => {
      const missing = targets.flatMap(([collection, path]) => {
        const { blocks, inline } = editor(collection, path)
        return slugs([...blocks, ...inline])
          .filter((slug) => !blockDescriptor(slug)?.[output as keyof typeof OUTPUTS])
          .map((slug) => `${slug} (${collection}.${path})`)
      })
      expect(missing, `declare \`${output}\` in these blocks' descriptors`).toEqual([])
    },
  )

  it("declares where every block that holds media keeps it", () => {
    const blocks = [...editors.values()].flatMap((e) => [...e.blocks, ...e.inline])
    const holding = slugs(blocks.filter((block) => holdsMedia(fieldsOf(block))))
    expect(holding).toContain("mediaBlock")
    const missing = holding.filter((slug) => !blockDescriptor(slug)?.media)
    expect(missing, "declare `media` in these blocks' descriptors").toEqual([])
  })
})

describe("the renderers", () => {
  const richText = (
    jsxConverters as unknown as (args: { defaultConverters: object }) => {
      blocks: Record<string, unknown>
      inlineBlocks: Record<string, unknown>
    }
  )({ defaultConverters: {} })

  it("RichText renders every block a rich-text editor offers", () => {
    const missing = [...editors.values()].flatMap((e) =>
      e.name === "pages.layout"
        ? [] // a layout's own blocks go through RenderBlocks; its rich text is below
        : [
            ...slugs(e.blocks).filter((slug) => !richText.blocks[slug]),
            ...slugs(e.inline).filter((slug) => !richText.inlineBlocks[slug]),
          ].map((slug) => `${slug} (${e.name})`),
    )
    // The Content block's rich text, inside a page's layout.
    const layoutRichText = editorsUnder(editor("pages", "layout").blocks.flatMap(fieldsOf)).flatMap(
      (field) => blocksIn(field).blocks,
    )
    expect(layoutRichText.length).toBeGreaterThan(0)
    missing.push(
      ...slugs(layoutRichText)
        .filter((slug) => !richText.blocks[slug])
        .map((slug) => `${slug} (pages.layout rich text)`),
    )
    expect(missing, "add these blocks to RichText's jsxConverters").toEqual([])
  })

  it("RenderBlocks renders every block a page's layout offers", () => {
    const offered = (config.collections.find(({ slug }) => slug === "pages")?.flattenedFields as
      ResolvedField[] | undefined)!.find(({ name }) => name === "layout")!.blocks!
    expect(slugs(offered)).toEqual([...LAYOUT_BLOCK_TYPES].sort())
  })
})
