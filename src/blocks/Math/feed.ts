import type { FeedBlockBehavior } from "@/app/(feed)/feed/blocks/types"

// Only the display variant participates in feed page layout.
// `inlineMathBlock` is a Lexical inline block and renders within prose.
export const displayMathBlockFeed: FeedBlockBehavior = {
  placement: "full-bleed",
  durationMs: 6000,
}
