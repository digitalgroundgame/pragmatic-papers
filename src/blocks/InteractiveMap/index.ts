import { MapIcon } from "lucide-react"

import { spokenText } from "@/blocks/narration"
import { defineBlock } from "@/blocks/types"
import type { InteractiveMapBlock } from "@/payload-types"
import { describeVisual } from "@/utilities/describeVisual"

import { interactiveMapToHTML, interactiveMapToImage } from "./converters"

export const interactiveMapBlock = defineBlock<InteractiveMapBlock>({
  slug: "interactiveMap",
  picker: () => import("./picker"),
  html: interactiveMapToHTML,
  // Substack posts show the map's picture, drawn when the article was published.
  substack: interactiveMapToImage,
  narrate: (fields) => {
    const title = spokenText(fields.widgetTitle)
    return describeVisual(title ? `an interactive map titled "${title}"` : "an interactive map")
  },
  tableOfContents: ({ widgetTitle, maps }) => ({
    label: widgetTitle || (maps?.length === 1 && maps[0]!.title) || "Map",
    icon: MapIcon,
  }),
})
