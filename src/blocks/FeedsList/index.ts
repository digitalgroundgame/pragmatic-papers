import { defineBlock } from "@/blocks/types"

export const feedsListBlock = defineBlock({
  slug: "feedsList",
  picker: () => import("./picker").then(({ feedsListPicker }) => feedsListPicker),
})
