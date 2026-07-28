import type { FeedBlockBehavior } from "@/app/(feed)/feed/blocks/types"
import type { LexicalNode } from "@/app/(feed)/feed/types"

export const mediaCollageFeed: FeedBlockBehavior = {
  placement: "split",
  durationMs: 8000,
  split: (node) => {
    const fields = node.fields as { images?: Array<{ media?: unknown }> } | undefined
    const images = fields?.images ?? []
    return images
      .filter((img): img is { media: unknown } => Boolean(img?.media))
      .map<LexicalNode>((img) => ({
        type: "block",
        version: 1,
        fields: {
          blockType: "mediaBlock",
          media: img.media,
        },
      }))
  },
}
