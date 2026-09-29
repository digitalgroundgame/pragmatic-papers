import type { FeedBlockRenderer } from "@/app/feed/blocks/types"
import type { Media as MediaType } from "@/payload-types"
import { isResolved } from "@/utilities/relationships"
import React from "react"
import { FullscreenMedia } from "./FullscreenMedia"

export const MediaBlockFeed: FeedBlockRenderer = ({ node }) => {
  const media = (node.fields as { media?: MediaType | number | null }).media
  if (!isResolved(media)) return null
  return <FullscreenMedia media={media} />
}
