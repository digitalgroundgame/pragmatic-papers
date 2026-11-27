import { defineBlock } from "@/blocks/types"

export const topicsListBlock = defineBlock({
  slug: "topicsList",
  picker: () => import("./picker"),
})
