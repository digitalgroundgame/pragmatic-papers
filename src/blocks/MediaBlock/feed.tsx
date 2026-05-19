import type { FeedBlockBehavior } from "@/app/(feed)/feed/blocks/types"
import type { Media as MediaType } from "@/payload-types"
import { FullscreenMedia } from "./FullscreenMedia"

export const mediaBlockFeed: FeedBlockBehavior = {
  placement: "full-bleed",
  durationMs: 6000,
  FeedComponent: ({ node }) => {
    const media = (node.fields as { media?: MediaType | number | null }).media
    if (!media || typeof media === "number") return null
    return <FullscreenMedia media={media} />
  },
}
