import { narrateAs } from "@/blocks/narration"
import { defineBlock } from "@/blocks/types"

export const volumeViewBlock = defineBlock({
  slug: "volumeView",
  narrate: narrateAs("volume view"),
  readingFeed: { placement: "full-bleed", durationMs: 6000 },
})
