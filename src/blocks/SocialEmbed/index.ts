import { TvIcon } from "lucide-react"

import type { FeedBlockBehavior } from "@/blocks/feed/types"
import { spokenText } from "@/blocks/narration"
import { defineBlock } from "@/blocks/types"
import type { SocialEmbedBlock } from "@/payload-types"
import { describeVisual } from "@/utilities/describeVisual"

import { socialEmbedToHTML } from "./converters"

const PLATFORM_LABELS: Record<NonNullable<SocialEmbedBlock["platform"]>, string> = {
  bluesky: "Bluesky",
  reddit: "Reddit",
  tiktok: "TikTok",
  twitter: "Twitter",
  youtube: "YouTube",
}

const readingFeed: FeedBlockBehavior = { placement: "full-bleed", durationMs: 8000 }

/**
 * The oEmbed title captured when the embed was last saved, usable as spoken detail, but only
 * from a successful fetch: `buildSnapshot` leaves sentinel titles like "No adapter found"
 * behind when it can't resolve a platform, and carries a stale title forward on network
 * failures.
 */
function snapshotTitle(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== "object") return ""
  const { status, title } = snapshot as Record<string, unknown>
  return status === "ok" ? spokenText(title) : ""
}

// Narration never reads the URL aloud: a spoken URL is unintelligible.
export const socialEmbedBlock = defineBlock<SocialEmbedBlock>({
  slug: "socialEmbed",
  html: socialEmbedToHTML,
  narrate: (fields) => {
    const platform = spokenText(fields.platform)
    return describeVisual(
      platform ? `an embedded ${platform} post` : "an embedded social media post",
      snapshotTitle(fields.snapshot),
    )
  },
  readingFeed,
  tableOfContents: ({ platform }) => ({
    label: platform ? `${PLATFORM_LABELS[platform]} embed` : "Social embed",
    icon: TvIcon,
  }),
})

/** One of the per-platform embed blocks old articles still hold, from before `socialEmbed`. */
const legacyEmbed = (slug: string, spoken: string) =>
  defineBlock<SocialEmbedBlock>({
    slug,
    html: socialEmbedToHTML,
    narrate: () => describeVisual(spoken),
    readingFeed,
  })

export const legacyEmbedBlocks = [
  legacyEmbed("blueSkyEmbed", "an embedded Bluesky post"),
  legacyEmbed("redditEmbed", "an embedded Reddit post"),
  legacyEmbed("tiktokEmbed", "an embedded TikTok video"),
  legacyEmbed("twitterEmbed", "an embedded Twitter post"),
  legacyEmbed("youtubeEmbed", "an embedded YouTube video"),
]
