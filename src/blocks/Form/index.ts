import { narrateAs } from "@/blocks/narration"
import { defineBlock } from "@/blocks/types"

export const formBlock = defineBlock({
  slug: "formBlock",
  narrate: narrateAs("form"),
  // Forms are interactive and tall, so on the reading feed they render as a centered button
  // that opens a dialog (`FeedFormBlock`); auto-play pauses while it's open.
  readingFeed: { placement: "full-bleed", durationMs: 6000 },
})
