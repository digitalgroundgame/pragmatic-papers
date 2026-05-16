import { BlueskyEmbedBlock } from "@/blocks/SocialEmbed/embeds/BlueskyEmbed"
import { EmbedError } from "@/blocks/SocialEmbed/embeds/EmbedError"
import { RedditEmbedBlock } from "@/blocks/SocialEmbed/embeds/RedditEmbed"
import { TikTokEmbedBlock } from "@/blocks/SocialEmbed/embeds/TikTokEmbed"
import { TwitterEmbedBlock } from "@/blocks/SocialEmbed/embeds/TwitterEmbed"
import { YouTubeEmbedBlock } from "@/blocks/SocialEmbed/embeds/YouTubeEmbed"
import { shouldRevalidate } from "@/blocks/SocialEmbed/helpers/snapshotFreshness"
import type { ParentDocContext } from "@/blocks/SocialEmbed/types"
import type { SocialEmbedBlock as SocialEmbedBlockProps } from "@/payload-types"
import React from "react"

export type SocialEmbedRenderProps = SocialEmbedBlockProps & {
  parentDoc?: ParentDocContext
}

export async function SocialEmbedBlock(props: SocialEmbedRenderProps): Promise<React.ReactNode> {
  let snapshot = props.snapshot
  if (shouldRevalidate(props.snapshot) && props.parentDoc && props.id) {
    const { revalidateSnapshot } = await import("@/blocks/SocialEmbed/hooks/revalidateSnapshot")
    snapshot = await revalidateSnapshot({
      parentDoc: props.parentDoc,
      embedBlockId: props.id,
      platform: props.platform,
      url: props.url,
      snapshot: props.snapshot,
    })
  }

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
