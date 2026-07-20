import type { Block } from "payload"

import { blockDescriptionField } from "@/fields/blockDescription"

export const MediaBlock: Block = {
  slug: "mediaBlock",
  interfaceName: "MediaBlock",
  fields: [
    blockDescriptionField(),
    {
      name: "media",
      type: "upload",
      relationTo: "media",
      required: true,
    },
  ],
}
