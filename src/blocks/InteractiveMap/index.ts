import { MapIcon } from "lucide-react"

import { spokenText } from "@/blocks/narration"
import { defineBlock } from "@/blocks/types"
import type { InteractiveMapBlock } from "@/payload-types"
import { describeVisual } from "@/utilities/describeVisual"

import { interactiveMapToHTML } from "./converters"

export const interactiveMapBlock = defineBlock<InteractiveMapBlock>({
  slug: "interactiveMap",
  html: interactiveMapToHTML,
  narrate: (fields) => {
    const title = spokenText(fields.widgetTitle)
    return describeVisual(title ? `an interactive map titled "${title}"` : "an interactive map")
  },
  tableOfContents: ({ widgetTitle, maps }) => ({
    label: widgetTitle || (maps?.length === 1 && maps[0]!.title) || "Map",
    icon: MapIcon,
  }),
})
