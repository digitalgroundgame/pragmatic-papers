import { BlueskyEmbedBlock } from "@/blocks/SocialEmbed/embeds/BlueskyEmbed"
import { EmbedError } from "@/blocks/SocialEmbed/embeds/EmbedError"
import { RedditEmbedBlock } from "@/blocks/SocialEmbed/embeds/RedditEmbed"
import { TikTokEmbedBlock } from "@/blocks/SocialEmbed/embeds/TikTokEmbed"
import { TwitterEmbedBlock } from "@/blocks/SocialEmbed/embeds/TwitterEmbed"
import { YouTubeEmbedBlock } from "@/blocks/SocialEmbed/embeds/YouTubeEmbed"
import type { SocialEmbedBlock as SocialEmbedBlockProps } from "@/payload-types"
import React from "react"

/**
 * Renders the snapshot saved with the article, however old. Rendering never writes: the
 * snapshot is fetched when the article is saved (`fetchSnapshot`).
 */
export function SocialEmbedBlock(props: SocialEmbedBlockProps): React.ReactNode {
  switch (props.platform) {
    case "bluesky":
      return <BlueskyEmbedBlock {...props} />
    case "reddit":
      return <RedditEmbedBlock {...props} />
    case "tiktok":
      return <TikTokEmbedBlock {...props} />
    case "twitter":
      return <TwitterEmbedBlock {...props} />
    case "youtube":
      return <YouTubeEmbedBlock {...props} />
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
