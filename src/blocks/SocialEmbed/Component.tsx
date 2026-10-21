import { BlueskyEmbedBlock } from "@/blocks/SocialEmbed/embeds/BlueskyEmbed"
import { EmbedError } from "@/blocks/SocialEmbed/embeds/EmbedError"
import { RedditEmbedBlock } from "@/blocks/SocialEmbed/embeds/RedditEmbed"
import { TikTokEmbedBlock } from "@/blocks/SocialEmbed/embeds/TikTokEmbed"
import { TwitterEmbedBlock } from "@/blocks/SocialEmbed/embeds/TwitterEmbed"
import { YouTubeEmbedBlock } from "@/blocks/SocialEmbed/embeds/YouTubeEmbed"
import { findRefreshedSnapshot } from "@/blocks/SocialEmbed/helpers/refreshedSnapshot"
import { newestSnapshot } from "@/blocks/SocialEmbed/helpers/snapshotFreshness"
import type { SocialEmbedBlock as SocialEmbedBlockProps } from "@/payload-types"
import React from "react"

/**
 * Renders the newer of the snapshot saved with the article and the one the daily
 * `refreshEmbedSnapshots` job fetched since, so a post deleted after the article was published
 * stops loading the platform's script.
 */
export async function SocialEmbedBlock(props: SocialEmbedBlockProps): Promise<React.ReactNode> {
  const snapshot = newestSnapshot(props.snapshot, await findRefreshedSnapshot(props))

  switch (props.platform) {
    case "bluesky":
      return <BlueskyEmbedBlock {...props} snapshot={snapshot} />
    case "reddit":
      return <RedditEmbedBlock {...props} snapshot={snapshot} />
    case "tiktok":
      return <TikTokEmbedBlock {...props} snapshot={snapshot} />
    case "twitter":
      return <TwitterEmbedBlock {...props} snapshot={snapshot} />
    case "youtube":
      return <YouTubeEmbedBlock {...props} snapshot={snapshot} />
    default:
      return (
        <EmbedError
          url={props.url}
          message="Social Media platform is not supported."
          displayName={props.platform}
        />
      )
  }
}
