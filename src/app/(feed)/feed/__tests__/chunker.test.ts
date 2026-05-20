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
    expect(pages[0]?.kind).toBe("hero")
  })

  it("always emits a thanks page as the last page", () => {
    const cases: FeedArticle[] = [
      makeArticle([]),
      makeArticle([paragraph(SHORT)]),
      makeArticle([paragraph(SHORT), block("mediaBlock")]),
      makeArticle([paragraph(LONG_120), heading("S"), paragraph(LONG_120)]),
    ]
    for (const article of cases) {
      const pages = chunkArticle(article)
      expect(pages[pages.length - 1]?.kind).toBe("thanks")
    }
  })

  it("groups short prose into a single content page", () => {
    const pages = chunkArticle(makeArticle([paragraph(SHORT), paragraph(SHORT)]))
    expect(pages.map((p) => p.kind)).toEqual(["hero", "content", "thanks"])
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
    expect(pages.map((p) => p.kind)).toEqual(["hero", "content", "block", "content", "thanks"])
    const blockPage = pages.find((p) => p.kind === "block")!
    expect(blockPage.kind).toBe("block")
    if (blockPage.kind === "block") {
      expect(blockPage.blockType).toBe("mediaBlock")
    }
  })

  it("keeps inline blocks like footnotes inside the prose chunk", () => {
    // banners / squiggleRule / code aren't in the full-bleed set; they ride with prose
    const pages = chunkArticle(makeArticle([paragraph(SHORT), block("banner"), paragraph(SHORT)]))
    expect(pages.map((p) => p.kind)).toEqual(["hero", "content", "thanks"])
  })

  it("starts a new page when a heading appears mid-buffer", () => {
    const pages = chunkArticle(
      makeArticle([paragraph(SHORT), heading("Section A"), paragraph(SHORT)]),
    )
    expect(pages.map((p) => p.kind)).toEqual(["hero", "content", "content", "thanks"])
  })

  it("doesn't create an empty content page when the article ends on a block", () => {
    const pages = chunkArticle(makeArticle([paragraph(SHORT), block("socialEmbed")]))
    expect(pages.map((p) => p.kind)).toEqual(["hero", "content", "block", "thanks"])
  })

  it("never emits a heading on a page by itself; it joins the next content chunk", () => {
    const pages = chunkArticle(
      makeArticle([paragraph(SHORT), heading("Section A"), paragraph(SHORT)]),
    )
    // [hero, prose(p1), prose(heading+p2), thanks]
    expect(pages.map((p) => p.kind)).toEqual(["hero", "content", "content", "thanks"])
    const second = pages[2]
    expect(second?.kind).toBe("content")
    if (second?.kind === "content") {
      expect(second.nodes[0]?.type).toBe("heading")
    }
  })

  it("attaches a pending heading to the following full-bleed block instead of a standalone page", () => {
    const pages = chunkArticle(
      makeArticle([paragraph(SHORT), heading("Gallery Section"), block("mediaBlock")]),
    )
    expect(pages.map((p) => p.kind)).toEqual(["hero", "content", "block", "thanks"])
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
    // [hero, prose, image1, image2, image3, thanks]
    expect(pages.map((p) => p.kind)).toEqual([
      "hero",
      "content",
      "block",
      "block",
      "block",
      "thanks",
    ])
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
    expect(pages.map((p) => p.kind)).toEqual(["hero", "content", "thanks"])
  })

  it("routes Form block to a full-bleed page via the sidecar (slug formBlock)", () => {
    // Verifies the slug fix: the old chunker had "form" hard-coded and missed this.
    const pages = chunkArticle(makeArticle([paragraph(SHORT), block("formBlock")]))
    expect(pages.map((p) => p.kind)).toEqual(["hero", "content", "block", "thanks"])
  })

  it("renders displayMathBlock inline (no longer full-bleed)", () => {
    const pages = chunkArticle(
      makeArticle([paragraph(SHORT), block("displayMathBlock"), paragraph(SHORT)]),
    )
    expect(pages.map((p) => p.kind)).toEqual(["hero", "content", "thanks"])
  })

  it("splits a Timeline block into pages of 3 events each", () => {
    const events = Array.from({ length: 7 }, (_, i) => ({
      date: `2020-01-0${i + 1}`,
      title: `Event ${i + 1}`,
    }))
    const tl = block("timeline", { events })
    const pages = chunkArticle(makeArticle([tl]))
    // 7 events → ceil(7/3) = 3 pages, plus the hero
    const blocks = pages.filter(
      (p): p is Extract<typeof p, { kind: "block" }> => p.kind === "block",
    )
    expect(blocks).toHaveLength(3)
    for (const b of blocks) expect(b.blockType).toBe("timeline")
    // First page has 3 events, last has 1
    const firstEvents = (blocks[0]?.node.fields as { events?: unknown[] }).events ?? []
    const lastEvents = (blocks[2]?.node.fields as { events?: unknown[] }).events ?? []
    expect(firstEvents).toHaveLength(3)
    expect(lastEvents).toHaveLength(1)
  })

  it("promotes a Lexical table node to a full-bleed page with synthetic blockType 'table'", () => {
    const table: LexicalNode = {
      type: "table",
      version: 1,
      children: [
        {
          type: "tablerow",
          version: 1,
          children: [
            { type: "tablecell", version: 1, headerState: 1, children: [paragraph("Col A")] },
            { type: "tablecell", version: 1, headerState: 1, children: [paragraph("Col B")] },
          ],
        },
        {
          type: "tablerow",
          version: 1,
          children: [
            { type: "tablecell", version: 1, headerState: 0, children: [paragraph("a1")] },
            { type: "tablecell", version: 1, headerState: 0, children: [paragraph("b1")] },
          ],
        },
      ],
    }
    const pages = chunkArticle(makeArticle([paragraph(SHORT), table]))
    expect(pages.map((p) => p.kind)).toEqual(["hero", "content", "block", "thanks"])
    const last = pages[2]
    if (last?.kind === "block") {
      expect(last.blockType).toBe("table")
    }
  })
})
