import { narrateAs } from "@/blocks/narration"
import { defineBlock } from "@/blocks/types"

export const ctaBlock = defineBlock({
  slug: "cta",
  picker: () => import("./picker"),
  narrate: narrateAs("call to action"),
})
