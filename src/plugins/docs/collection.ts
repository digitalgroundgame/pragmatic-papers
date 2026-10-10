import { editor } from "@/access/collections"
import { isPublishedOrStaff } from "@/access/policies"
import { isEditor, type Role, STAFF_ROLES } from "@/access/roles"
import { Banner } from "@/blocks/Banner/config"
import { Code } from "@/blocks/Code/config"
import { MediaBlock } from "@/blocks/MediaBlock/config"
import { MediaCollageBlock } from "@/blocks/MediaCollageBlock/config"
import { populateTableOfContentsAnchors, tableOfContentsField } from "@/components/TableOfContents"
import { slugField } from "@/fields/slug"
import { generatePreviewPath } from "@/utilities/generatePreviewPath"
import {
  BlocksFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineCodeFeature,
  InlineToolbarFeature,
  lexicalEditor,
  OrderedListFeature,
  UnorderedListFeature,
} from "@payloadcms/richtext-lexical"
import type { Access, CollectionConfig } from "payload"

import { revalidateDoc, revalidateDocDelete } from "./revalidateDoc"
import { DEFAULT_DOC_SECTION, DOC_SECTIONS } from "./sections"

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
 * Editors, but on a deployed site only for docs written there: a doc from src/docs/ is
 * overwritten by the next deploy that changes it, so an edit here would be lost. Locally it
 * stays editable, since that's where `pnpm docs:export` reads a changed doc from.
 */
const updateDoc: Access = ({ req: { user } }) => {
  if (!isEditor(user)) return false
  if (process.env.NODE_ENV === "development") return true
  return { sourceHash: { exists: false } }
}

/**
 * Help articles at /docs/<slug>, about what staff can do in the admin. Most arrive with a
 * release: each deploy writes the ones in src/docs/ into its site's database (see
 * `syncRepoDocs`). Editors can also write one here.
 */
export const Docs: CollectionConfig<"docs"> = {
  slug: DOCS_SLUG,
  labels: { singular: "Doc", plural: "Docs" },
  access: {
    create: editor,
    delete: editor,
    read: isPublishedOrStaff,
    update: updateDoc,
  },
  defaultPopulate: {
    title: true,
    slug: true,
  },
  admin: {
    group: "Help",
    useAsTitle: "title",
    defaultColumns: ["title", "section", "audience", "publishedAt", "updatedAt"],
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
      name: "navTitle",
      label: "Sidebar title",
      type: "text",
      admin: {
        description:
          'A short name for the docs sidebar, like "Footnotes". Left empty, the sidebar shows the title.',
      },
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
      // Not shown on the doc itself: it's the doc's picture elsewhere.
      name: "heroImage",
      type: "upload",
      relationTo: "media",
      required: true,
      admin: {
        position: "sidebar",
        description:
          "The help bell shows it beside the title, and link previews use it. It isn't shown on the doc.",
      },
    },
    {
      name: "content",
      type: "richText",
      required: true,
      hooks: {
        beforeChange: [populateTableOfContentsAnchors],
      },
      editor: lexicalEditor({
        features: ({ rootFeatures }) => [
          ...rootFeatures,
          HeadingFeature({ enabledHeadingSizes: ["h2", "h3"] }),
          BlocksFeature({ blocks: [Banner, Code, MediaBlock, MediaCollageBlock] }),
          FixedToolbarFeature(),
          InlineToolbarFeature(),
          HorizontalRuleFeature(),
          // Docs name things to type, like /banner, in code.
          InlineCodeFeature(),
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
      name: "revisedAt",
      label: "Updated",
      type: "date",
      admin: {
        position: "sidebar",
        date: { pickerAppearance: "dayOnly", displayFormat: "MMMM d, yyyy" },
        description:
          "The day the doc last changed in a way readers should know about, shown beside its date. The bell still lists it under the published date.",
      },
    },
    {
      name: "section",
      type: "select",
      required: true,
      defaultValue: DEFAULT_DOC_SECTION,
      options: DOC_SECTIONS.map(({ value, label }) => ({ value, label })),
      admin: {
        position: "sidebar",
        description: "Where the doc sits in the sidebar at /docs.",
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
    // On by default: a doc is reference reading, skimmed for the one section a reader needs.
    tableOfContentsField({ defaultValue: true }),
    {
      // Set by `syncDocs` on a doc it wrote from src/docs/, so the next deploy can tell
      // whether the repo's copy changed. Empty on docs written here.
      name: "sourceHash",
      type: "text",
      label: "From the repo",
      admin: {
        position: "sidebar",
        readOnly: true,
        condition: (data) => Boolean(data?.sourceHash),
        description:
          "This doc ships with the code, so it can't be edited here. Change its Markdown file in src/docs/ instead.",
      },
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
