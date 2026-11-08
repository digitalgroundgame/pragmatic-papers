import { narrateAs } from "@/blocks/narration"
import { defineBlock } from "@/blocks/types"

export const contributorsBlock = defineBlock({
  slug: "contributors",
  picker: () => import("./picker").then(({ contributorsPicker }) => contributorsPicker),
  narrate: narrateAs("contributors block"),
})
