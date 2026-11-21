import type { Block } from "payload"

import { blockImages } from "@/blocks/blockImages"

export const MediaCollageBlock: Block = {
  slug: "mediaCollage",
  admin: { images: blockImages("mediaCollage") },
  interfaceName: "MediaCollageBlock",
  fields: [
    {
      name: "layout",
      type: "select",
      label: "Layout",
      options: [
        { label: "Grid", value: "grid" },
        { label: "Carousel", value: "carousel" },
      ],
      defaultValue: "grid",
      required: true,
    },
    {
      name: "images",
      type: "array",
      label: "Images",
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
      required: true,
    },
  ],
}
