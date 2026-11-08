import { narrateAs } from "@/blocks/narration"
import { defineBlock } from "@/blocks/types"

export const formBlock = defineBlock({
  slug: "formBlock",
  picker: () => import("./picker"),
  narrate: narrateAs("form"),
})
