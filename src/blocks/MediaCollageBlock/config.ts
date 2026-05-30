import type { Block } from "payload"

export const MediaCollageBlock: Block = {
  slug: "mediaCollage",
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
          required: true,
        },
      ],
      required: true,
    },
  ],
}
