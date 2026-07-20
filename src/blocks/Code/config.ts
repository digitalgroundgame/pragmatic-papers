import type { Block } from "payload"

import { blockDescriptionField } from "@/fields/blockDescription"

export const Code: Block = {
  slug: "code",
  interfaceName: "CodeBlock",
  fields: [
    blockDescriptionField(),
    {
      name: "language",
      type: "select",
      defaultValue: "typescript",
      options: [
        {
          label: "Typescript",
          value: "typescript",
        },
        {
          label: "Javascript",
          value: "javascript",
        },
        {
          label: "CSS",
          value: "css",
        },
      ],
    },
    {
      name: "code",
      type: "code",
      label: false,
      required: true,
    },
  ],
}
