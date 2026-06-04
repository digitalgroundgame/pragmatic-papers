import { TvIcon } from "lucide-react"

import { createTableOfContents } from "./create"
import type { SocialEmbedBlock } from "@/payload-types"

export { createIntroAnchor } from "./headingConverter"

const PLATFORM_LABELS: Record<NonNullable<SocialEmbedBlock["platform"]>, string> = {
  bluesky: "Bluesky",
  reddit: "Reddit",
  tiktok: "TikTok",
  twitter: "Twitter",
  youtube: "YouTube",
}

export const { TableOfContents, tableOfContentsField, tableOfContentsConverter } =
  createTableOfContents({
    resolvers: {
      socialEmbed: (block) => {
        const fields = block as SocialEmbedBlock
        if (!fields.id) return null
        const label = fields.platform ? `${PLATFORM_LABELS[fields.platform]} embed` : "Social embed"
        return { label, anchor: fields.id, icon: TvIcon }
      },
    },
  })
