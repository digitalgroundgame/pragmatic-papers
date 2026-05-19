import type { FeedBlockBehavior } from "@/app/(feed)/feed/blocks/types"

// Block slug is `formBlock`. The previous chunker constant referenced `form`,
// which silently dropped the form block back into prose — the sidecar fixes it.
export const formFeed: FeedBlockBehavior = {
  placement: "full-bleed",
  durationMs: 6000,
}
