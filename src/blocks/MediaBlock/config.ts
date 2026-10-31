import type { Block } from "payload"

import { blockImages } from "@/blocks/blockImages"

export const MediaBlock: Block = {
  slug: "mediaBlock",
  admin: { images: blockImages("mediaBlock") },
  interfaceName: "MediaBlock",
  fields: [
    {
      name: "media",
      type: "upload",
      relationTo: "media",
      filterOptions: {
        or: [{ mimeType: { contains: "image" } }, { mimeType: { contains: "video" } }],
      },
      required: true,
    },
  ],
}
