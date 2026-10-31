import type { Article, Volume } from "@/payload-types"
import type React from "react"

/**
 * The reading feed's contract with blocks (`/feed`): how a block occupies the
 * feed's pages, and the renderer a block may give its page. Lives with the
 * blocks so a block can declare its feed behavior without importing the feed's
 * route; `src/app/feed` depends on this, never the reverse.
 */

/** A serialized Lexical node, as the feed's chunker reads it. */
export interface LexicalNode {
  type: string
  version?: number
  [key: string]: unknown
}

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

export type FeedBlockPlacement = "inline" | "full-bleed" | "split"

export interface FeedBlockBehavior {
  /** How this block occupies space in the feed.
   *  - `inline`: rides in a prose chunk (default for unregistered blocks)
   *  - `full-bleed`: gets its own full-screen page
   *  - `split`: produces N pages, one per node returned from `split()`
   */
  placement: FeedBlockPlacement

  /** Required when placement is `split`. Returns synthetic block nodes;
   *  each becomes its own feed page. */
  split?: (node: LexicalNode) => LexicalNode[]

  /** Auto-play dwell in ms for this block's page. Defaults to 6000ms. */
  durationMs?: number
}

/** A feed-specific renderer for one block page. Runs on the server, so it may
 *  be async and may render RichText. A block declares it as `readingFeed` in
 *  its render descriptor; blocks without one fall back to the RichText JSX
 *  converters. */
export type FeedBlockRenderer = (props: {
  node: LexicalNode
  article: FeedArticle
}) => React.ReactNode | Promise<React.ReactNode>
