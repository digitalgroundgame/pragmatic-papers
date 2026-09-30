import type { Block } from "payload"

export const MediaBlock: Block = {
  slug: "mediaBlock",
  interfaceName: "MediaBlock",
  fields: [
    {
      name: "media",
      type: "upload",
      relationTo: "media",
      // Images and video only: these render in a lightbox, whose trigger button
      // can't hold an audio player's controls (#1035).
      filterOptions: {
        or: [{ mimeType: { contains: "image" } }, { mimeType: { contains: "video" } }],
      },
      required: true,
    },
  ],
}
