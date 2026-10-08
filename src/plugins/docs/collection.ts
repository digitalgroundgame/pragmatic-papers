import { editor } from "@/access/collections"
import { isPublishedOrStaff } from "@/access/policies"
import { type Role, STAFF_ROLES } from "@/access/roles"
import { Banner } from "@/blocks/Banner/config"
import { Code } from "@/blocks/Code/config"
import { MediaBlock } from "@/blocks/MediaBlock/config"
import { MediaCollageBlock } from "@/blocks/MediaCollageBlock/config"
import { slugField } from "@/fields/slug"
import { generatePreviewPath } from "@/utilities/generatePreviewPath"
import {
  BlocksFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  lexicalEditor,
  OrderedListFeature,
  UnorderedListFeature,
} from "@payloadcms/richtext-lexical"
import type { CollectionConfig } from "payload"

import { revalidateDoc, revalidateDocDelete } from "./revalidateDoc"

export const DOCS_SLUG = "docs"

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  "chief-editor": "Chief Editor",
  editor: "Editor",
  writer: "Writer",
  narrator: "Narrator",
  member: "Member",
}

/**
 * Help articles at /docs/<slug>, about what staff can do in the admin. Most arrive with a
 * release: the docs plugin writes the ones in src/docs/ into every site's database when it
 * starts (see `syncDocs`). Editors can also write one here.
 */
export const Docs: CollectionConfig<"docs"> = {
  slug: DOCS_SLUG,
  labels: { singular: "Doc", plural: "Docs" },
  access: {
    create: editor,
    delete: editor,
    read: isPublishedOrStaff,
    update: editor,
  },
  defaultPopulate: {
    title: true,
    slug: true,
  },
  admin: {
    group: "Help",
    useAsTitle: "title",
    defaultColumns: ["title", "audience", "publishedAt", "updatedAt"],
    livePreview: {
      url: ({ data, req }) => generatePreviewPath({ slug: data?.slug, collection: DOCS_SLUG, req }),
    },
    preview: (data, { req }) =>
      generatePreviewPath({ slug: data?.slug as string, collection: DOCS_SLUG, req }),
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "summary",
      type: "textarea",
      required: true,
      maxLength: 200,
      admin: {
        description: "One or two sentences. The help bell shows it under the title.",
      },
    },
    {
      name: "content",
      type: "richText",
      required: true,
      editor: lexicalEditor({
        features: ({ rootFeatures }) => [
          ...rootFeatures,
          HeadingFeature({ enabledHeadingSizes: ["h2", "h3"] }),
          BlocksFeature({ blocks: [Banner, Code, MediaBlock, MediaCollageBlock] }),
          FixedToolbarFeature(),
          InlineToolbarFeature(),
          HorizontalRuleFeature(),
          UnorderedListFeature(),
          OrderedListFeature(),
        ],
      }),
    },
    {
      name: "publishedAt",
      type: "date",
      required: true,
      admin: {
        position: "sidebar",
        date: { pickerAppearance: "dayOnly", displayFormat: "MMMM d, yyyy" },
        description: "The day the feature reaches the live site. Newest docs list first.",
      },
    },
    {
      name: "audience",
      type: "select",
      hasMany: true,
      options: STAFF_ROLES.map((role) => ({ label: ROLE_LABELS[role], value: role })),
      admin: {
        position: "sidebar",
        description: "Who the help bell tells. Empty means all staff; admins see every doc.",
      },
    },
    {
      // Set by `syncDocs` on a doc it wrote from src/docs/, so the next start can tell
      // whether the repo's copy changed. Empty on docs written here.
      name: "sourceHash",
      type: "text",
      admin: { hidden: true, readOnly: true },
    },
    slugField(),
  ],
  hooks: {
    afterChange: [revalidateDoc],
    afterDelete: [revalidateDocDelete],
  },
  versions: {
    drafts: {
      autosave: true,
    },
    maxPerDoc: 50,
  },
}
