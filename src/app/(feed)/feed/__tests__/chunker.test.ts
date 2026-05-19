import { describe, expect, it } from "vitest"
import { chunkArticle, countWordsInNode } from "../chunker"
import type { FeedArticle, LexicalNode } from "../types"

function paragraph(text: string): LexicalNode {
  return {
    type: "paragraph",
    version: 1,
    children: [{ type: "text", version: 1, text }],
  }
}

function heading(text: string, tag = "h2"): LexicalNode {
  return {
    type: "heading",
    tag,
    version: 1,
    children: [{ type: "text", version: 1, text }],
  }
}

function block(blockType: string, fields: Record<string, unknown> = {}): LexicalNode {
  return {
    type: "block",
    version: 1,
    fields: { blockType, ...fields },
  }
}

function makeArticle(children: LexicalNode[]): FeedArticle {
  return {
    id: 1,
    slug: "test",
    title: "Test",
    heroImage: null,
    publishedAt: null,
    enableMathRendering: false,
    content: {
      root: {
        type: "root",
        version: 1,
        children,
        direction: "ltr",
        format: "",
        indent: 0,
      },
    } as FeedArticle["content"],
    populatedAuthors: [],
  }
}

const SHORT = "one two three four five"
const LONG_120 = Array.from({ length: 120 }, (_, i) => `w${i}`).join(" ")

describe("countWordsInNode", () => {
  it("counts words in a text leaf", () => {
    expect(countWordsInNode({ type: "text", version: 1, text: "hello world" })).toBe(2)
  })

  it("descends into children", () => {
    expect(countWordsInNode(paragraph("a b c"))).toBe(3)
  })

  it("returns 0 for whitespace-only text", () => {
    expect(countWordsInNode({ type: "text", version: 1, text: "   " })).toBe(0)
  })
})

describe("chunkArticle", () => {
  it("always emits a hero page first", () => {
    const pages = chunkArticle(makeArticle([]))
    expect(pages).toHaveLength(1)
    expect(pages[0]?.kind).toBe("hero")
  })

  it("groups short prose into a single content page", () => {
    const pages = chunkArticle(makeArticle([paragraph(SHORT), paragraph(SHORT)]))
    expect(pages.map((p) => p.kind)).toEqual(["hero", "content"])
  })

  it("splits prose that exceeds the per-page word target", () => {
    const pages = chunkArticle(
      makeArticle([paragraph(LONG_120), paragraph(LONG_120), paragraph(LONG_120)]),
    )
    const contentPages = pages.filter((p) => p.kind === "content")
    expect(contentPages.length).toBeGreaterThan(1)
  })

  it("promotes full-bleed blocks to their own page and flushes the buffer", () => {
    const pages = chunkArticle(
      makeArticle([paragraph(SHORT), block("mediaBlock"), paragraph(SHORT)]),
    )
    expect(pages.map((p) => p.kind)).toEqual(["hero", "content", "block", "content"])
    const blockPage = pages.find((p) => p.kind === "block")!
    expect(blockPage.kind).toBe("block")
    if (blockPage.kind === "block") {
      expect(blockPage.blockType).toBe("mediaBlock")
    }
  })

  it("keeps inline blocks like footnotes inside the prose chunk", () => {
    // banners / squiggleRule / code aren't in the full-bleed set; they ride with prose
    const pages = chunkArticle(makeArticle([paragraph(SHORT), block("banner"), paragraph(SHORT)]))
    expect(pages.map((p) => p.kind)).toEqual(["hero", "content"])
  })

  it("starts a new page when a heading appears mid-buffer", () => {
    const pages = chunkArticle(
      makeArticle([paragraph(SHORT), heading("Section A"), paragraph(SHORT)]),
    )
    expect(pages.map((p) => p.kind)).toEqual(["hero", "content", "content"])
  })

  it("doesn't create an empty content page when the article ends on a block", () => {
    const pages = chunkArticle(makeArticle([paragraph(SHORT), block("socialEmbed")]))
    expect(pages.map((p) => p.kind)).toEqual(["hero", "content", "block"])
  })
})
