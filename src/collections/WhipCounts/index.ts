import type { CollectionConfig } from "payload"

import { editor } from "@/access/collections"
import { isPublishedOrStaff } from "@/access/policies"
import { slugField } from "@/fields/slug"
import { populatePublishedAt } from "@/hooks/populatePublishedAt"
import { parseWhipCount, WHIP_COUNT_SCHEMA } from "@/interactives/whip-count/model"
import { generatePreviewPath } from "@/utilities/generatePreviewPath"
import { rememberReadersCopy } from "@/utilities/readersCopy"

import { revalidateWhipCount, revalidateWhipCountDelete } from "./hooks/revalidateWhipCount"

/**
 * Whip counts — a leadership vote tracked voter by voter, one per document, at
 * /interactives/whip-counts/<slug>. The page shows the public count and lets a reader draft
 * their own guess of how the vote breaks.
 *
 * The count itself is one JSON document an editor pastes into `data`; `parseWhipCount`
 * (`src/interactives/whip-count/model.ts`) is its schema and refuses a paste it can't read.
 * Part of the `interactives` experiment: with it off, the pages 404.
 */
export const WhipCounts: CollectionConfig<"whip-counts"> = {
  slug: "whip-counts",
  labels: {
    singular: "Whip count",
    plural: "Whip counts",
  },
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
    defaultColumns: ["title", "slug", "_status", "updatedAt"],
    description:
      "A leadership vote tracked voter by voter. Editors own the words and each voter's position, edited row by row or pasted as JSON; readers draft their own guess on the page.",
    group: "Interactives",
    livePreview: {
      url: ({ data, req }) =>
        generatePreviewPath({ slug: data?.slug, collection: "whip-counts", req }),
    },
    preview: (data, { req }) =>
      generatePreviewPath({ slug: data?.slug as string, collection: "whip-counts", req }),
    useAsTitle: "title",
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "intro",
      type: "textarea",
      admin: {
        description:
          "Standfirst shown above the count, and the page's description in search results and link previews.",
      },
    },
    {
      name: "data",
      type: "json",
      required: true,
      admin: {
        components: {
          Field: "@/collections/WhipCounts/components/WhipCountDataField#WhipCountDataField",
        },
        description: `The count: every voter's public position, edited row by row. To start a count or replace it whole, use "Edit as JSON" and paste a document (schema "${WHIP_COUNT_SCHEMA}"). Saving checks it and says what is wrong.`,
      },
      validate: (value: unknown): true | string => {
        const parsed = parseWhipCount(value)
        return parsed.success ? true : parsed.error
      },
    },
    {
      name: "autoPublish",
      type: "checkbox",
      defaultValue: false,
      label: "Publish pushed updates",
      admin: {
        description:
          "A count pushed to this document from outside (POST /next/whip-counts/<slug>) is saved as a draft for an editor to publish. Tick this to publish each one as it arrives instead, without a review, except while this document has unpublished changes of yours, which a push never publishes. Blocs and tags set here are kept either way.",
      },
    },
    {
      name: "methodology",
      type: "textarea",
      admin: {
        description: "How positions are assigned and what is unconfirmed. Shown under the count.",
      },
    },
    {
      name: "publishedAt",
      type: "date",
      admin: { position: "sidebar" },
    },
    slugField(),
  ],
  hooks: {
    afterChange: [revalidateWhipCount],
    beforeChange: [rememberReadersCopy, populatePublishedAt],
    afterDelete: [revalidateWhipCountDelete],
  },
  versions: {
    drafts: {
      autosave: true,
      schedulePublish: true,
    },
    maxPerDoc: 50,
  },
}
