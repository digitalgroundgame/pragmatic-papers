import { narrateAs } from "@/blocks/narration"
import { defineBlock } from "@/blocks/types"

export const contentBlock = defineBlock({
  slug: "content",
  picker: () => import("./picker").then(({ contentPicker }) => contentPicker),
  narrate: narrateAs("content block"),
})
