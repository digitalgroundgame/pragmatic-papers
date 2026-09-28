import { ChartGanttIcon, ImagesIcon, MapIcon, TvIcon, type LucideIcon } from "lucide-react"

import type {
  InteractiveMapBlock,
  MediaCollageBlock,
  SocialEmbedBlock,
  TimelineBlock,
} from "@/payload-types"
import { createTableOfContents } from "./create"

const PLATFORM_LABELS: Record<NonNullable<SocialEmbedBlock["platform"]>, string> = {
  bluesky: "Bluesky",
  reddit: "Reddit",
  tiktok: "TikTok",
  twitter: "Twitter",
  youtube: "YouTube",
}

function entryIcon(Icon: LucideIcon): React.ReactNode {
  return <Icon aria-hidden="true" className="text-muted-foreground size-3 shrink-0" />
}

export const {
  TableOfContentsProvider,
  TableOfContents,
  TableOfContentsButton,
  tableOfContentsField,
  tableOfContentsConverter,
  withTableOfContentsAnchors,
  tableOfContentsEntries,
  stampTableOfContentsAnchors,
  populateTableOfContentsAnchors,
} = createTableOfContents({
  resolvers: {
    /* Add block customization here */
    interactiveMap: (block) => {
      const { widgetTitle, maps } = block as InteractiveMapBlock
      const label = widgetTitle || (maps?.length === 1 && maps[0]!.title) || "Map"
      return { label, icon: entryIcon(MapIcon) }
    },
    mediaCollage: (block) => {
      const { images, layout } = block as MediaCollageBlock
      if (!images?.length) return null
      return {
        label: layout === "carousel" ? "Carousel" : "Image grid",
        icon: entryIcon(ImagesIcon),
      }
    },
    socialEmbed: (block) => {
      const { platform } = block as SocialEmbedBlock
      const label = platform ? `${PLATFORM_LABELS[platform]} embed` : "Social embed"
      return { label, icon: entryIcon(TvIcon) }
    },
    timeline: (block) => {
      const { title } = block as TimelineBlock
      return { label: title || "Timeline", icon: entryIcon(ChartGanttIcon) }
    },
  },
})
