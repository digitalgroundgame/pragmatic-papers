import type React from "react"
import type { FeedArticle, LexicalNode } from "../types"

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
 *  be async and may render RichText. Wired up in `renderers.tsx`; blocks
 *  without one fall back to the global RichText JSX converters. */
export type FeedBlockRenderer = (props: {
  node: LexicalNode
  article: FeedArticle
}) => React.ReactNode | Promise<React.ReactNode>
