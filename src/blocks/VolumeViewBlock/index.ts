import { narrateAs } from "@/blocks/narration"
import { defineBlock } from "@/blocks/types"

export const volumeViewBlock = defineBlock({
  slug: "volumeView",
  picker: () => import("./picker"),
  narrate: narrateAs("volume view"),
})
