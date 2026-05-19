import type { Article } from "@/payload-types"

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
  | "footnotes"
>

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
}

export type ArticlePageItem = HeroPageKind | ProseChunk | BlockPageKind

export interface FeedBatch {
  items: FeedArticle[]
  nextCursor: number | null
}
