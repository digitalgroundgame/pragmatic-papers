import type { FeedBlockBehavior } from "@/app/(feed)/feed/blocks/types"

// Block slug is `cta` (registry key matches).
export const ctaFeed: FeedBlockBehavior = {
  placement: "full-bleed",
  durationMs: 6000,
}
