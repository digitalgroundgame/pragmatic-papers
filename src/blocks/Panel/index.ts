import { defineBlock } from "@/blocks/types"

export const panelBlock = defineBlock({
  slug: "panel",
  picker: () => import("./picker"),
})
