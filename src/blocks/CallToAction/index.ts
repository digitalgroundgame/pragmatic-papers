import { narrateAs } from "@/blocks/narration"
import { defineBlock } from "@/blocks/types"

export const ctaBlock = defineBlock({
  slug: "cta",
  narrate: narrateAs("call to action"),
  readingFeed: { placement: "full-bleed", durationMs: 6000 },
})
