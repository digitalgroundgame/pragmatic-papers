import { rememberReadersCopy } from "@/utilities/readersCopy"
import { editor } from "@/access/collections"
import { isPublishedOrStaff } from "@/access/policies"
import { type Role, STAFF_ROLES } from "@/access/roles"
import { Banner } from "@/blocks/Banner/config"
import { Code } from "@/blocks/Code/config"
import { MediaBlock } from "@/blocks/MediaBlock/config"
import { MediaCollageBlock } from "@/blocks/MediaCollageBlock/config"
import { populateTableOfContentsAnchors, tableOfContentsField } from "@/components/TableOfContents"
import { slugField } from "@/fields/slug"
import { TOURS } from "@/plugins/tours"
import { generatePreviewPath } from "@/utilities/generatePreviewPath"
import { createParentField } from "@payloadcms/plugin-nested-docs"
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
import type { CollectionConfig } from "payload"

import { revalidateDoc, revalidateDocDelete } from "./revalidateDoc"
import { DOC_SUGGESTIONS_SLUG, deleteDocSuggestions } from "./suggestionsCollection"

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
 * Help articles at /docs, about how the site works. They nest (the nested docs plugin adds each
 * one's `parent` and `breadcrumbs`): an area like Writing has no parent, its sections sit under
 * it, and their docs under them, so a doc is read at `/docs/<area>/<section>/<slug>`. Editors
 * drag docs into order among their siblings, and move one by picking its parent. Most arrive
 * with a release: each deploy adds the ones in src/docs/ its site doesn't have yet, as drafts
 * for an editor to rewrite and publish (see `syncRepoDocs`). From then on the doc is the site's:
 * editors change it here, and the repo's later changes arrive beside it as suggestions
 * (`DocSuggestions`), never in it. Editors can also write one from scratch.
 */
export const Docs: CollectionConfig<"docs"> = {
  slug: DOCS_SLUG,
  labels: { singular: "Doc", plural: "Docs" },
  // Dragged into order in the list: siblings sit in that order in the sidebar.
  orderable: true,
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
    defaultColumns: ["title", "navTitle", "parent", "audience", "updatedAt", "_status"],
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
    // The sidebar shows these in this order.
    {
      name: "heroImage",
      type: "upload",
      relationTo: "media",
      admin: {
        position: "sidebar",
        description:
          "Shown above the doc's title, beside it in the help bell, and in link previews. Optional.",
      },
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
    slugField(),
    // The nested docs plugin adds `parent` at the end; declaring it here puts it under the slug
    // in the sidebar. The plugin finds it by name and adds its own filter.
    createParentField(DOCS_SLUG),
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
      name: "tour",
      type: "text",
      admin: {
        position: "sidebar",
        description: `A guided tour of the feature, offered as Show me in the help bell and on the doc. One of: ${Object.keys(TOURS).join(", ")}.`,
      },
      validate: (value: string | null | undefined) =>
        !value || Object.hasOwn(TOURS, value) || `No tour is called "${value}".`,
    },
    {
      // Set by `syncDocs` on a doc it seeded from src/docs/: the hash of the files it came
      // from. Empty on docs written here.
      name: "sourceHash",
      type: "text",
      label: "From the repo",
      admin: {
        position: "sidebar",
        readOnly: true,
        condition: (data) => Boolean(data?.sourceHash),
        description:
          "Seeded from src/docs/ by a deploy, as a first draft for you to rewrite. The doc is yours from then on: when the repo's copy changes, a deploy lists what changed under Suggestions, and never changes the doc.",
      },
    },
    {
      name: "suggestions",
      type: "join",
      collection: DOC_SUGGESTIONS_SLUG,
      on: "doc",
      defaultSort: "-updatedAt",
      admin: {
        defaultColumns: ["title", "status", "updatedAt"],
        description:
          "The repo's changes to this doc since it was seeded. Open one to see what changed, work it into the doc in your own words, then mark it done.",
      },
    },
  ],
  hooks: {
    beforeChange: [rememberReadersCopy],
    afterChange: [revalidateDoc],
    afterDelete: [revalidateDocDelete, deleteDocSuggestions],
  },
  versions: {
    drafts: {
      autosave: true,
    },
    maxPerDoc: 50,
  },
}
