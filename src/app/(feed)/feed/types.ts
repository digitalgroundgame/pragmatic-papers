import type { Article } from "@/payload-types"
import type { AdSlot } from "./ads/registry"

export type { AdSlot } from "./ads/registry"

export interface FeedNextArticle {
  slug: string
  title: string
  heroImageUrl: string | null
  authorName: string | null
}

export type FeedArticle = Pick<
  Article,
  | "id"
  | "slug"
  | "title"
  | "heroImage"
  | "publishedAt"
  | "enableMathRendering"
  | "content"
  | "populatedAuthors"
  | "populatedVolume"
  | "topics"
  | "meta"
  | "footnotes"
> & {
  nextArticle?: FeedNextArticle | null
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

export interface ThanksPageKind {
  kind: "thanks"
  article: FeedArticle
}

export type ArticlePageItem = HeroPageKind | ProseChunk | BlockPageKind | ThanksPageKind

export interface FeedBatch {
  items: FeedArticle[]
  nextCursor: number | null
}

export type FeedSlot =
  | { kind: "article"; key: string; article: FeedArticle }
  | { kind: "ad"; key: string; ad: AdSlot }
