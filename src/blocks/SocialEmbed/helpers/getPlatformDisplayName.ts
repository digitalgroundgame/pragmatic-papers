import { BLUESKY_DISPLAY_NAME } from "@/blocks/SocialEmbed/adapters/bluesky.adapter"
import { REDDIT_DISPLAY_NAME } from "@/blocks/SocialEmbed/adapters/reddit.adapter"
import { TIKTOK_DISPLAY_NAME } from "@/blocks/SocialEmbed/adapters/tiktok.adapter"
import { TWITTER_DISPLAY_NAME } from "@/blocks/SocialEmbed/adapters/twitter.adapter"
import { YOUTUBE_DISPLAY_NAME } from "@/blocks/SocialEmbed/adapters/youtube.adapter"
import type { SocialPlatform } from "@/payload-types"

export function getPlatformDisplayName(platform: SocialPlatform): string {
  switch (platform) {
    case "twitter":
      return TWITTER_DISPLAY_NAME
    case "youtube":
      return YOUTUBE_DISPLAY_NAME
    case "bluesky":
      return BLUESKY_DISPLAY_NAME
    case "reddit":
      return REDDIT_DISPLAY_NAME
    case "tiktok":
      return TIKTOK_DISPLAY_NAME
    default:
      return "Unknown"
  }
}
