import { narrateAs } from "@/blocks/narration"
import { defineBlock } from "@/blocks/types"

export const contributorsBlock = defineBlock({
  slug: "contributors",
  narrate: narrateAs("contributors block"),
  readingFeed: { placement: "full-bleed", durationMs: 6000 },
})
