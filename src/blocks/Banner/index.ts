import { describeBlockAs } from "@/blocks/narration"
import { defineBlock } from "@/blocks/types"
import type { BannerBlock } from "@/payload-types"

import { bannerToHTML } from "./converters"

export const bannerBlock = defineBlock<BannerBlock>({
  slug: "banner",
  html: bannerToHTML,
  // A banner carries real, readable prose: narrate it as a set-apart note rather than
  // describing it as a visual.
  narrate: (fields, { textOf }) => {
    const text = textOf(fields.content).trim()
    return text ? `Note: ${text}` : describeBlockAs("banner", fields)
  },
})
