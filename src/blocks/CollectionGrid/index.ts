import { narrateAs } from "@/blocks/narration"
import { defineBlock } from "@/blocks/types"

export const collectionGridBlock = defineBlock({
  slug: "collectionGrid",
  narrate: narrateAs("collection grid"),
  readingFeed: { placement: "full-bleed", durationMs: 6000 },
})
