import type { Block } from "payload"

import { STAFF_ROLES } from "@/access/roles"

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
      // Each card links to /authors/<slug>, which only staff and public profiles have.
      filterOptions: {
        or: [{ roles: { in: STAFF_ROLES } }, { publicProfile: { equals: true } }],
      },
    },
  ],
  labels: {
    plural: "Contributors",
    singular: "Contributors",
  },
}
