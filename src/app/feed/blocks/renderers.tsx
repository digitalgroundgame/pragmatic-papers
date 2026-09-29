import "server-only"

import { FeedFormBlock } from "@/blocks/Form/FeedFormBlock"
import { MediaBlockFeed } from "@/blocks/MediaBlock/MediaBlockFeed"
import React from "react"
import { FeedTableRowReflow } from "./FeedTableRowReflow"
import type { FeedBlockRenderer } from "./types"

// Feed-specific renderers, keyed like the behavior registry. Kept apart from
// `registry.ts` because they render on the server (RichText is server-only),
// while the chunking behavior is plain data the tests import directly.
// Returns undefined for blocks with no feed renderer, which then fall back to
// the RichText converters.
export function renderFeedBlock(
  blockType: string,
  props: Parameters<FeedBlockRenderer>[0],
): React.ReactNode | undefined {
  switch (blockType) {
    case "mediaBlock":
      return <MediaBlockFeed {...props} />
    case "formBlock":
      return <FeedFormBlock {...props} />
    case "table":
      return <FeedTableRowReflow {...props} />
    default:
      return undefined
  }
}
