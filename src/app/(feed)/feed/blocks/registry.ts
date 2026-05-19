import { ctaFeed } from "@/blocks/CallToAction/feed"
import { collectionGridFeed } from "@/blocks/CollectionGrid/feed"
import { contributorsFeed } from "@/blocks/Contributors/feed"
import { formFeed } from "@/blocks/Form/feed"
import { displayMathBlockFeed } from "@/blocks/Math/feed"
import { mediaBlockFeed } from "@/blocks/MediaBlock/feed"
import { mediaCollageFeed } from "@/blocks/MediaCollageBlock/feed"
import { socialEmbedFeed } from "@/blocks/SocialEmbed/feed"
import { timelineFeed } from "@/blocks/Timeline/feed"
import { volumeViewFeed } from "@/blocks/VolumeViewBlock/feed"
import type { FeedBlockBehavior } from "./types"

// Single hand-maintained index of feed behavior per block slug.
// To add or tune a block in the feed: create or edit
// `src/blocks/<Name>/feed.ts` and add one line here.
const registry: Record<string, FeedBlockBehavior> = {
  mediaBlock: mediaBlockFeed,
  mediaCollage: mediaCollageFeed,
  socialEmbed: socialEmbedFeed,
  // Deprecated socialEmbed subtype aliases — share the same behavior.
  twitterEmbed: socialEmbedFeed,
  youtubeEmbed: socialEmbedFeed,
  redditEmbed: socialEmbedFeed,
  blueSkyEmbed: socialEmbedFeed,
  tiktokEmbed: socialEmbedFeed,
  timeline: timelineFeed,
  displayMathBlock: displayMathBlockFeed,
  cta: ctaFeed,
  contributors: contributorsFeed,
  collectionGrid: collectionGridFeed,
  formBlock: formFeed,
  volumeView: volumeViewFeed,
}

const DEFAULT_BEHAVIOR: FeedBlockBehavior = { placement: "inline" }

export function getFeedBlockBehavior(blockType: string): FeedBlockBehavior {
  return registry[blockType] ?? DEFAULT_BEHAVIOR
}
