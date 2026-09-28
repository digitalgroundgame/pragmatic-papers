import type { Article, Volume } from "@/payload-types"
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

export interface FeedBatch {
  items: FeedArticle[]
  nextCursor: number | null
}

export type FeedSlot =
  { kind: "article"; key: string; article: FeedArticle } | { kind: "ad"; key: string; ad: AdSlot }
