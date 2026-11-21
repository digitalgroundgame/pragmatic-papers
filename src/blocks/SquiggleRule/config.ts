import type { Block } from "payload"

import { blockImages } from "@/blocks/blockImages"

export const SquiggleRule: Block = {
  slug: "squiggleRule",
  admin: { images: blockImages("squiggleRule") },
  interfaceName: "SquiggleRuleBlock",
  fields: [
    {
      name: "variant",
      type: "select",
      defaultValue: "animated",
      options: [
        { label: "Animated", value: "animated" },
        { label: "Static", value: "static" },
      ],
      required: true,
    },
    {
      name: "size",
      type: "select",
      defaultValue: "small",
      options: [
        { label: "Small", value: "small" },
        { label: "Medium", value: "medium" },
        { label: "Large", value: "large" },
        { label: "Full Width", value: "full" },
      ],
      required: false,
    },
  ],
}
