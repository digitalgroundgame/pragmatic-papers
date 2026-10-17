import { editor } from "@/access/collections"
import { slugField } from "@/fields/slug"
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionConfig,
  Where,
} from "payload"

import { revalidateDocs } from "./revalidateDoc"

export const DOC_SECTIONS_SLUG = "doc-sections"

/**
 * The docs sidebar's areas and sections, which editors own: an area (Writing) has no parent,
 * and a section (Articles) has an area as its parent. Dragged into order in the list, they're
 * in that order in the sidebar. The nested docs plugin keeps each one's breadcrumbs. A deploy
 * adds the starter ones in `src/docs/sections.json` once (`syncDocSections`); a section's slug
 * is its folder in src/docs/.
 */
export const DocSections: CollectionConfig = {
  slug: DOC_SECTIONS_SLUG,
  labels: { singular: "Section", plural: "Sections" },
  orderable: true,
  access: {
    create: editor,
    delete: editor,
    read: () => true,
    update: editor,
  },
  admin: {
    group: "Help",
    useAsTitle: "title",
    defaultColumns: ["title", "parent", "slug"],
    description:
      "The docs sidebar's areas, and the sections under each. Drag them into the order the sidebar shows. Empty ones stay out of the sidebar.",
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "parent",
      label: "Area",
      type: "relationship",
      relationTo: DOC_SECTIONS_SLUG,
      // Two levels: a section's parent is an area, never another section.
      filterOptions: ({ id }): Where =>
        id
          ? { and: [{ parent: { exists: false } }, { id: { not_equals: id } }] }
          : { parent: { exists: false } },
      admin: {
        position: "sidebar",
        description: "Leave empty to make this an area, a heading in the sidebar.",
      },
    },
    slugField(),
  ],
  hooks: {
    afterChange: [
      (({ doc, req }) => {
        if (!req.context.disableRevalidate) revalidateDocs(req.payload.logger, "doc sections")
        return doc
      }) satisfies CollectionAfterChangeHook,
    ],
    afterDelete: [
      (({ doc, req }) => {
        if (!req.context.disableRevalidate)
          revalidateDocs(req.payload.logger, "doc section deleted")
        return doc
      }) satisfies CollectionAfterDeleteHook,
    ],
  },
}
