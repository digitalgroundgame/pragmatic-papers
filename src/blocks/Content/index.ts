import { narrateAs } from "@/blocks/narration"
import { defineBlock } from "@/blocks/types"

export const contentBlock = defineBlock({
  slug: "content",
  picker: () => import("./picker"),
  narrate: narrateAs("content block"),
})
