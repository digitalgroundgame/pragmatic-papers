import type { Media, Topic, User } from "@/payload-types"
import type { FeedArticle, FeedArticleSummary, LexicalNode } from "../types"

// Kept here rather than borrowed from `src/stories/fixtures`: the Docker build
// type-checks tests but leaves the stories directory out of its context.
const TIMESTAMP = "2026-01-15T12:00:00.000Z"

export const landscapeImage: Media = {
  id: 1,
  alt: "Mountains at sunset",
  url: "/landscape.svg",
  filename: "landscape.svg",
  mimeType: "image/svg+xml",
  width: 1600,
  height: 900,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
}

export function userFixture(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    name: "Jordan Rivera",
    slug: "jordan-rivera",
    email: "jordan@example.com",
    profileImage: { ...landscapeImage, id: 2, alt: "Portrait of Jordan Rivera" },
    roles: ["writer"],
    collection: "users",
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  }
}

export function topicFixture(overrides: Partial<Topic> = {}): Topic {
  return {
    id: 1,
    name: "Elections",
    slug: "elections",
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  }
}

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
