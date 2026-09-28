import type { FeedBlockBehavior } from "@/app/(feed)/feed/blocks/types"

// Block slug is `formBlock`. Forms are interactive and tall, so on the
// feed they render as a centered CTA that opens a focus-trapped dialog
// (`FeedFormBlock`); the feed's auto-play pauses while the dialog is open.
export const formFeed: FeedBlockBehavior = {
  placement: "full-bleed",
  durationMs: 6000,
}
