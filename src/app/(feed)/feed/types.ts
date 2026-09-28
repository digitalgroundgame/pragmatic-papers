import type { Article, Volume } from "@/payload-types"
import type React from "react"
import type { AdSlot } from "./ads/registry"

export type { AdSlot } from "./ads/registry"

// `volume` isn't an Article field: `getFeedBatch` resolves it in one batched
// query (see `queryVolumesForArticles`) and attaches the fields the hero shows.
export type FeedArticle = Pick<
  Article,
  | "id"
  | "slug"
  | "title"
  | "heroImage"
  | "publishedAt"
  | "enableMathRendering"
  | "content"
  | "authors"
  | "topics"
  | "meta"
  | "footnotes"
> & {
  volume?: Pick<Volume, "id" | "title" | "slug"> | null
}

export interface LexicalNode {
  type: string
  version?: number
  [key: string]: unknown
}

export interface ProseChunk {
  kind: "content"
  nodes: LexicalNode[]
  wordCount: number
}

export interface HeroPageKind {
  kind: "hero"
  article: FeedArticle
}

export interface BlockPageKind {
  kind: "block"
  node: LexicalNode
  blockType: string
  headingNode?: LexicalNode
}

export type ArticlePageItem = HeroPageKind | ProseChunk | BlockPageKind

/** What the client needs of an article: the body is already rendered. */
export type FeedArticleSummary = Omit<FeedArticle, "content" | "footnotes">

/** The client's view of a page: enough to lay out the pager and time auto-play. */
export interface FeedPageMeta {
  kind: ArticlePageItem["kind"]
  durationMs: number
}

/**
 * An article with every page rendered on the server. `bodies[i]` is page i's
 * content, or null for the hero, which the client draws from `article`.
 * Rich text is server-only (its blocks query Payload), so the client never
 * renders article content itself.
 */
export interface RenderedFeedArticle {
  article: FeedArticleSummary
  pages: FeedPageMeta[]
  bodies: React.ReactNode[]
}

export interface FeedArticleBatch {
  items: FeedArticle[]
  nextCursor: number | null
}

export interface FeedBatch {
  items: RenderedFeedArticle[]
  nextCursor: number | null
}

export type FeedSlot =
  | { kind: "article"; key: string; article: RenderedFeedArticle }
  | { kind: "ad"; key: string; ad: AdSlot }
