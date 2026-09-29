import { describe, expect, it } from "vitest"

import { detachFromBlocks, detachUpdate, resolveDetachTarget } from "../detach"

const lexical = (...children: unknown[]) => ({
  root: { type: "root", children, direction: null, format: "", indent: 0, version: 1 },
})
const block = (fields: Record<string, unknown>) => ({ type: "block", version: 2, fields })
const paragraph = { type: "paragraph", children: [{ type: "text", text: "Keep me" }] }

describe("resolveDetachTarget", () => {
  it("reads an upload field", () => {
    expect(resolveDetachTarget("articles", "heroImage")).toMatchObject({
      field: "heroImage",
      kind: "upload",
    })
    expect(resolveDetachTarget("pages", "meta.image")).toMatchObject({
      field: "meta.image",
      kind: "upload",
    })
  })

  it("reads a rich text or blocks field without its block types", () => {
    expect(resolveDetachTarget("articles", "content (mediaBlock, timeline)")).toMatchObject({
      field: "content",
      kind: "blocks",
    })
    expect(resolveDetachTarget("pages", "layout (timeline)")).toMatchObject({
      field: "layout",
      kind: "blocks",
    })
  })

  it("refuses fields and collections media isn't used from", () => {
    expect(resolveDetachTarget("articles", "title")).toBeUndefined()
    expect(resolveDetachTarget("articles", "profileImage")).toBeUndefined()
    expect(resolveDetachTarget("media", "alt")).toBeUndefined()
  })
})

describe("detachFromBlocks", () => {
  it("removes a media block from rich text and keeps the rest", () => {
    const content = lexical(paragraph, block({ blockType: "mediaBlock", media: 42 }))

    expect(detachFromBlocks(content, 42)).toEqual(lexical(paragraph))
  })

  it("removes a media block that shows the media, populated or not, anywhere in the tree", () => {
    const content = lexical({
      type: "list",
      children: [
        { type: "listitem", children: [block({ blockType: "mediaBlock", media: { id: 42 } })] },
      ],
    })

    expect(detachFromBlocks(content, "42")).toEqual(
      lexical({ type: "list", children: [{ type: "listitem", children: [] }] }),
    )
  })

  it("drops the image from a collage and keeps the others", () => {
    const content = lexical(
      block({ blockType: "mediaCollage", layout: "grid", images: [{ media: 7 }, { media: 42 }] }),
    )

    expect(detachFromBlocks(content, 42)).toEqual(
      lexical(block({ blockType: "mediaCollage", layout: "grid", images: [{ media: 7 }] })),
    )
  })

  it("removes a collage whose last image it was, since a collage needs one", () => {
    const content = lexical(
      paragraph,
      block({ blockType: "mediaCollage", images: [{ media: 42 }] }),
    )

    expect(detachFromBlocks(content, 42)).toEqual(lexical(paragraph))
  })

  it("clears a timeline event's avatar and keeps the event", () => {
    const layout = [
      {
        blockType: "timeline",
        events: [
          { title: "Kept", avatar: 7 },
          { title: "Cleared", avatar: 42 },
        ],
      },
    ]

    expect(detachFromBlocks(layout, 42)).toEqual([
      {
        blockType: "timeline",
        events: [
          { title: "Kept", avatar: 7 },
          { title: "Cleared", avatar: null },
        ],
      },
    ])
  })

  it("removes a media block from a page layout", () => {
    const layout = [
      { blockType: "content", columns: [] },
      { blockType: "mediaBlock", media: 42 },
    ]

    expect(detachFromBlocks(layout, 42)).toEqual([{ blockType: "content", columns: [] }])
  })

  it("reports nothing to change when the media isn't there", () => {
    const content = lexical(paragraph, block({ blockType: "mediaBlock", media: 7 }))

    expect(detachFromBlocks(content, 42)).toBeUndefined()
    expect(detachFromBlocks(null, 42)).toBeUndefined()
  })

  it("leaves the value it was given unchanged", () => {
    const content = lexical(block({ blockType: "mediaBlock", media: 42 }))
    const before = JSON.stringify(content)

    detachFromBlocks(content, 42)

    expect(JSON.stringify(content)).toBe(before)
  })
})

describe("detachUpdate", () => {
  const target = (collection: string, field: string) => resolveDetachTarget(collection, field)!

  it("clears a top-level upload", () => {
    expect(detachUpdate({ heroImage: 42 }, target("articles", "heroImage"), 42)).toEqual({
      heroImage: null,
    })
  })

  it("clears a nested upload and keeps the rest of its group", () => {
    const doc = { meta: { title: "T", description: "D", image: 42 } }

    expect(detachUpdate(doc, target("articles", "meta.image"), 42)).toEqual({
      meta: { title: "T", description: "D", image: null },
    })
  })

  it("rewrites a rich text field", () => {
    const doc = { content: lexical(paragraph, block({ blockType: "mediaBlock", media: 42 })) }

    expect(detachUpdate(doc, target("articles", "content (mediaBlock)"), 42)).toEqual({
      content: lexical(paragraph),
    })
  })

  it("has nothing to do when the field doesn't use the media", () => {
    expect(detachUpdate({ heroImage: 7 }, target("articles", "heroImage"), 42)).toBeUndefined()
    expect(detachUpdate({}, target("articles", "meta.image"), 42)).toBeUndefined()
    expect(detachUpdate({ content: lexical() }, target("articles", "content"), 42)).toBeUndefined()
  })
})
