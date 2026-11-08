import { defineBlock } from "@/blocks/types"

export const merchBlock = defineBlock({
  slug: "merch",
  picker: () => import("./picker").then(({ merchPicker }) => merchPicker),
})
