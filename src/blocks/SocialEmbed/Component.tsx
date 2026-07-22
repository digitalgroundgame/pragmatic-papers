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

  let embedContent: React.ReactNode

  switch (props.platform) {
    case "bluesky":
      embedContent = <BlueskyEmbedBlock {...props} snapshot={snapshot} />
      break
    case "reddit":
      embedContent = <RedditEmbedBlock {...props} snapshot={snapshot} />
      break
    case "tiktok":
      embedContent = <TikTokEmbedBlock {...props} snapshot={snapshot} />
      break
    case "twitter":
      embedContent = <TwitterEmbedBlock {...props} snapshot={snapshot} />
      break
    case "youtube":
      embedContent = <YouTubeEmbedBlock {...props} snapshot={snapshot} />
      break
    default:
      embedContent = (
        <EmbedError
          url={props.url}
          message="Social Media platform is not supported."
          displayName={props.platform}
        />
      )
  }

  if (!embedContent) return null

  return (
    <div
      role={props.description ? "region" : undefined}
      aria-label={props.description ?? undefined}
    >
      {embedContent}
    </div>
  )
}
