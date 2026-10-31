import { narrateAs } from "@/blocks/narration"
import { defineBlock } from "@/blocks/types"

export const contentBlock = defineBlock({
  slug: "content",
  narrate: narrateAs("content block"),
})
