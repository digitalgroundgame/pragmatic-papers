import type { FeedArticle, FeedArticleSummary, LexicalNode } from "../types"

export function paragraph(text: string): LexicalNode {
  return { type: "paragraph", version: 1, children: [{ type: "text", version: 1, text }] }
}

export function block(blockType: string, fields: Record<string, unknown> = {}): LexicalNode {
  return { type: "block", version: 1, fields: { blockType, ...fields } }
}

export function makeFeedArticle(
  overrides: Partial<FeedArticle> = {},
  children: LexicalNode[] = [paragraph("one two three")],
): FeedArticle {
  return {
    id: 1,
    slug: "an-article",
    title: "An article",
    heroImage: null,
    publishedAt: "2026-09-01T00:00:00.000Z",
    enableMathRendering: false,
    authors: [],
    topics: [],
    meta: { description: "A short description." },
    volume: null,
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
    ...overrides,
  }
}

export function makeSummary(overrides: Partial<FeedArticle> = {}): FeedArticleSummary {
  const { content: _content, footnotes: _footnotes, ...summary } = makeFeedArticle(overrides)
  return summary
}
