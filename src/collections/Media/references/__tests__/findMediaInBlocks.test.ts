import { describe, expect, it } from "vitest"
import { findMediaInBlocks, isMediaId } from "../findMediaInBlocks"

const lexical = (...children: unknown[]): unknown => ({ root: { type: "root", children } })
const blockNode = (fields: Record<string, unknown>): unknown => ({ type: "block", fields })

describe("isMediaId", () => {
  it("matches an id across number and string", () => {
    expect(isMediaId(42, "42")).toBe(true)
    expect(isMediaId("42", 42)).toBe(true)
  })

  it("matches a populated document by its id", () => {
    expect(isMediaId({ id: 42, url: "/x.png" }, 42)).toBe(true)
  })

  it("does not match empty or different values", () => {
    expect(isMediaId(null, 42)).toBe(false)
    expect(isMediaId(undefined, 42)).toBe(false)
    expect(isMediaId(7, 42)).toBe(false)
    expect(isMediaId({ id: 7 }, 42)).toBe(false)
  })
})

describe("findMediaInBlocks", () => {
  it("finds a media block in rich text", () => {
    const content = lexical(blockNode({ blockType: "mediaBlock", media: 42 }))
    expect(findMediaInBlocks(content, 42)).toEqual(["mediaBlock"])
  })

  it("finds an image in a media collage", () => {
    const content = lexical(
      blockNode({ blockType: "mediaCollage", images: [{ media: 7 }, { media: 42 }] }),
    )
    expect(findMediaInBlocks(content, 42)).toEqual(["mediaCollage"])
  })

  it("finds a timeline event avatar", () => {
    const content = lexical(
      blockNode({ blockType: "timeline", events: [{ title: "a" }, { avatar: 42 }] }),
    )
    expect(findMediaInBlocks(content, 42)).toEqual(["timeline"])
  })

  it("finds blocks in a blocks field, as in a page layout", () => {
    const layout = [
      { blockType: "content", columns: [] },
      { blockType: "mediaBlock", media: { id: 42 } },
      { blockType: "timeline", events: [{ avatar: 42 }] },
    ]
    expect(findMediaInBlocks(layout, 42)).toEqual(["mediaBlock", "timeline"])
  })

  it("finds blocks nested under other nodes", () => {
    const content = lexical({
      type: "list",
      children: [
        { type: "listitem", children: [blockNode({ blockType: "mediaBlock", media: 42 })] },
      ],
    })
    expect(findMediaInBlocks(content, 42)).toEqual(["mediaBlock"])
  })

  it("names each block type once", () => {
    const content = lexical(
      blockNode({ blockType: "mediaBlock", media: 42 }),
      blockNode({ blockType: "mediaBlock", media: 42 }),
    )
    expect(findMediaInBlocks(content, 42)).toEqual(["mediaBlock"])
  })

  it("ignores other media, and media fields on blocks that don't hold media", () => {
    const content = lexical(
      blockNode({ blockType: "mediaBlock", media: 7 }),
      blockNode({ blockType: "banner", media: 42 }),
      { type: "paragraph", children: [{ type: "text", text: "42" }] },
    )
    expect(findMediaInBlocks(content, 42)).toEqual([])
  })

  it("returns nothing for empty values", () => {
    expect(findMediaInBlocks(null, 42)).toEqual([])
    expect(findMediaInBlocks(undefined, 42)).toEqual([])
    expect(findMediaInBlocks({}, 42)).toEqual([])
  })
})
