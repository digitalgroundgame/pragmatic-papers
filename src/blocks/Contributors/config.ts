import type { Block } from "payload"

export const Contributors: Block = {
  slug: "contributors",
  interfaceName: "ContributorsBlock",
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "people",
      type: "relationship",
      relationTo: "users",
      hasMany: true,
      required: true,
    },
  ],
  labels: {
    plural: "Contributors",
    singular: "Contributors",
  },
}
