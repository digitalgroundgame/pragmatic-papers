import type { SocialAdapter } from "@/blocks/SocialEmbed/adapters/base.adapter"
import { blueskyAdapter } from "@/blocks/SocialEmbed/adapters/bluesky.adapter"
import { redditAdapter } from "@/blocks/SocialEmbed/adapters/reddit.adapter"
import { tiktokAdapter } from "@/blocks/SocialEmbed/adapters/tiktok.adapter"
import { twitterAdapter } from "@/blocks/SocialEmbed/adapters/twitter.adapter"
import { youtubeAdapter } from "@/blocks/SocialEmbed/adapters/youtube.adapter"
import type { SocialPlatform } from "@/payload-types"

/**
 * Registry mapping social platforms to their adapters.
 * Add new platform adapters here as they are implemented.
 */
const adapters: Partial<Record<SocialPlatform, SocialAdapter>> = {
  bluesky: blueskyAdapter,
  reddit: redditAdapter,
  tiktok: tiktokAdapter,
  twitter: twitterAdapter,
  youtube: youtubeAdapter,
} as const

/**
 * Gets the adapter for a given platform.
 * @param platform - The social platform
 * @returns The adapter for the platform, or undefined if not found
 */
export function getAdapter(platform: SocialPlatform): SocialAdapter | null {
  return adapters[platform] || null
}
