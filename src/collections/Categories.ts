import type { CollectionConfig } from "payload"

import { anyone } from "../access/anyone"
import { authenticated } from "../access/authenticated"
import { slugField } from "payload"

export const Categories: CollectionConfig = {
  slug: "categories",
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  admin: {
    useAsTitle: "title",
    hidden: true, // TODO: Remove collection from repo
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "testMigrationTrigger",
      type: "checkbox",
      defaultValue: false,
      admin: {
        description:
          "This field exists solely to trigger a pending migration for testing CI workflows.",
      },
    },
    slugField(),
  ],
}
