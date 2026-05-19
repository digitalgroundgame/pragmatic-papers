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

  it("never emits a heading on a page by itself; it joins the next content chunk", () => {
    const pages = chunkArticle(
      makeArticle([paragraph(SHORT), heading("Section A"), paragraph(SHORT)]),
    )
    // [hero, prose(p1), prose(heading+p2)]
    expect(pages.map((p) => p.kind)).toEqual(["hero", "content", "content"])
    const second = pages[2]
    expect(second?.kind).toBe("content")
    if (second?.kind === "content") {
      expect(second.nodes[0]?.type).toBe("heading")
    }
  })

  it("attaches a pending heading to the following full-bleed block instead of a standalone page", () => {
    const pages = chunkArticle(
      makeArticle([paragraph(SHORT), heading("Math Section"), block("displayMathBlock")]),
    )
    expect(pages.map((p) => p.kind)).toEqual(["hero", "content", "block"])
    const last = pages[2]
    if (last?.kind === "block") {
      expect(last.headingNode?.type).toBe("heading")
    }
  })

  it("splits a mediaCollage into one page per image", () => {
    const collage = block("mediaCollage", {
      images: [{ media: 1 }, { media: 2 }, { media: 3 }],
    })
    const pages = chunkArticle(makeArticle([paragraph(SHORT), collage]))
    // [hero, prose, image1, image2, image3]
    expect(pages.map((p) => p.kind)).toEqual(["hero", "content", "block", "block", "block"])
    const imagePages = pages.filter((p) => p.kind === "block")
    for (const p of imagePages) {
      if (p.kind === "block") {
        expect(p.blockType).toBe("mediaBlock")
      }
    }
  })

  it("attaches a heading to only the first image of a mediaCollage split", () => {
    const collage = block("mediaCollage", { images: [{ media: 1 }, { media: 2 }] })
    const pages = chunkArticle(makeArticle([heading("Gallery"), collage]))
    const blocks = pages.filter(
      (p): p is Extract<typeof p, { kind: "block" }> => p.kind === "block",
    )
    expect(blocks).toHaveLength(2)
    expect(blocks[0]?.headingNode?.type).toBe("heading")
    expect(blocks[1]?.headingNode).toBeUndefined()
  })

  it("treats a block without a registered sidecar as inline (rides in prose)", () => {
    // "code" has no sidecar — should not break a prose chunk.
    const pages = chunkArticle(makeArticle([paragraph(SHORT), block("code"), paragraph(SHORT)]))
    expect(pages.map((p) => p.kind)).toEqual(["hero", "content"])
  })

  it("routes Form block to a full-bleed page via the sidecar (slug formBlock)", () => {
    // Verifies the slug fix: the old chunker had "form" hard-coded and missed this.
    const pages = chunkArticle(makeArticle([paragraph(SHORT), block("formBlock")]))
    expect(pages.map((p) => p.kind)).toEqual(["hero", "content", "block"])
  })
})
