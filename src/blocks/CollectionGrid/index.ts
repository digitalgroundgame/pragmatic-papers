import { narrateAs } from "@/blocks/narration"
import { defineBlock } from "@/blocks/types"

export const collectionGridBlock = defineBlock({
  slug: "collectionGrid",
  picker: () => import("./picker"),
  narrate: narrateAs("collection grid"),
})
