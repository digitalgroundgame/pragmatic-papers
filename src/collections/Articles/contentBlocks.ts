import { Banner } from "@/blocks/Banner/config"
import { Code } from "@/blocks/Code/config"
import { FootnoteBlock } from "@/blocks/Footnote/config"
import { InteractiveMap } from "@/blocks/InteractiveMap/config"
import { DisplayMathBlock, InlineMathBlock } from "@/blocks/Math/config"
import { MediaBlock } from "@/blocks/MediaBlock/config"
import { MediaCollageBlock } from "@/blocks/MediaCollageBlock/config"
import { SocialEmbed } from "@/blocks/SocialEmbed/config"
import { LegacyBlueskyEmbed } from "@/blocks/SocialEmbed/embeds/BlueskyEmbed/config"
import { LegacyRedditEmbed } from "@/blocks/SocialEmbed/embeds/RedditEmbed/config"
import { LegacyTikTokEmbed } from "@/blocks/SocialEmbed/embeds/TikTokEmbed/config"
import { LegacyTwitterEmbed } from "@/blocks/SocialEmbed/embeds/TwitterEmbed/config"
import { LegacyYouTubeEmbed } from "@/blocks/SocialEmbed/embeds/YouTubeEmbed/config"
import { SquiggleRule } from "@/blocks/SquiggleRule/config"
import { Timeline } from "@/blocks/Timeline/config"
import type { Block } from "payload"

/**
 * Blocks allowed in an article's content. Shared with the RSS feed's
 * converter test, so every block added here needs a feed converter too.
 */
export const articleContentBlocks: Block[] = [
  Banner,
  Code,
  InteractiveMap,
  MediaBlock,
  MediaCollageBlock,
  DisplayMathBlock,
  SquiggleRule,
  SocialEmbed,
  Timeline,
  // Legacy blocks for backward compatibility with existing content
  LegacyBlueskyEmbed,
  LegacyRedditEmbed,
  LegacyTikTokEmbed,
  LegacyTwitterEmbed,
  LegacyYouTubeEmbed,
]

export const articleInlineBlocks: Block[] = [InlineMathBlock, FootnoteBlock]
