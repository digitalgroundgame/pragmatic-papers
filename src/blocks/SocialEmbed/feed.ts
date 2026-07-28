import type { FeedBlockBehavior } from "@/app/(feed)/feed/blocks/types"

// Shared by socialEmbed and its 5 deprecated subtype aliases
// (twitterEmbed, youtubeEmbed, redditEmbed, blueSkyEmbed, tiktokEmbed).
// Registry wires the aliases — no per-subtype sidecar files.
export const socialEmbedFeed: FeedBlockBehavior = {
  placement: "full-bleed",
  durationMs: 8000,
}
