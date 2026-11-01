import { defineBlock } from "@/blocks/types"
import type { MediaBlock } from "@/payload-types"
import { describeVisual } from "@/utilities/describeVisual"

import { mediaBlockToHTML } from "./converters"

export const mediaBlock = defineBlock<MediaBlock>({
  slug: "mediaBlock",
  html: mediaBlockToHTML,
  // Its caption, or else its alt text. A media block with neither narrates as "(An image.)".
  narrate: (fields, { describeMedia }) =>
    describeVisual("an image", fields.media ? describeMedia(fields.media) : ""),
  // Rendered by `MediaBlockFeed` (see the reading feed's `blocks/renderers.tsx`).
  readingFeed: { placement: "full-bleed", durationMs: 6000 },
  media: {
    find: (block) => [block.media],
    // A media block is nothing without its media, so it goes.
    detach: (block, uses) => (uses(block.media) ? null : block),
  },
})
