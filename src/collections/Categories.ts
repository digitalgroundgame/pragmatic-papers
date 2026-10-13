import type { CollectionConfig } from "payload"

import { anyone, staff } from "../access/collections"
import { slugField } from "@/fields/slug"

export const Categories: CollectionConfig = {
  slug: "categories",
  access: {
    create: staff,
    delete: staff,
    read: anyone,
    update: staff,
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
    slugField(),
  ],
}
