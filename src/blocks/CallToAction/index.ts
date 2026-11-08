import { narrateAs } from "@/blocks/narration"
import { defineBlock } from "@/blocks/types"

export const ctaBlock = defineBlock({
  slug: "cta",
  picker: () => import("./picker").then(({ ctaPicker }) => ctaPicker),
  narrate: narrateAs("call to action"),
})
