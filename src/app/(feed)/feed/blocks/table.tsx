import { FeedTableRowReflow } from "./FeedTableRowReflow"
import type { FeedBlockBehavior } from "./types"

// Lexical native `table` nodes — not a Payload block. The chunker
// synthesises a virtual blockType "table" for them and we route the
// rendering through a row-reflow component so the table reads
// vertically on a phone-shaped viewport without conflicting with the
// feed's horizontal swipe gesture.
export const tableFeed: FeedBlockBehavior = {
  placement: "full-bleed",
  durationMs: 6000,
  FeedComponent: ({ node }) => <FeedTableRowReflow node={node} />,
}
