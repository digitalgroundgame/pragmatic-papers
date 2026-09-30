import type { Block } from "payload"

export const MediaBlock: Block = {
  slug: "mediaBlock",
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
