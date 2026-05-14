import { slugField, type CollectionConfig } from "payload"

import {
  AlignFeature,
  BlockquoteFeature,
  BlocksFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  IndentFeature,
  InlineToolbarFeature,
  lexicalEditor,
  OrderedListFeature,
  UnorderedListFeature,
} from "@payloadcms/richtext-lexical"

import { editor } from "@/access/editor"
import { authenticatedOrPublished } from "@/access/authenticatedOrPublished"
import { Banner } from "@/blocks/Banner/config"
import { Code } from "@/blocks/Code/config"
import { MediaBlock } from "@/blocks/MediaBlock/config"
import { SquiggleRule } from "@/blocks/SquiggleRule/config"
import { draftVersions, previewAdminConfig, setPublishedAtDefault } from "@/collections/helpers"
import { seoTab } from "@/fields/seoTab"

import { checkArticles } from "./hooks/checkArticles"
import { getNextVolumeNumber } from "./hooks/getNextVolumeNumber"
import { pushToWebhooks } from "./hooks/pushToWebhooks"
import { revalidateDelete, revalidateVolume } from "./hooks/revalidateVolumes"
import { setDefaultSeoTitle } from "./hooks/seoTitle"

export const Volumes: CollectionConfig = {
  slug: "volumes",
  access: {
    create: editor,
    delete: editor,
    read: authenticatedOrPublished,
    update: editor,
  },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "volumeNumber", "publishedAt", "description"],
    ...previewAdminConfig("volumes"),
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "volumeNumber",
      type: "number",
      defaultValue: getNextVolumeNumber,
      admin: {
        position: "sidebar",
      },
      required: true,
    },
    {
      type: "tabs",
      tabs: [
        {
          fields: [
            {
              name: "description",
              type: "textarea",
              required: true,
            },
            {
              name: "editorsNote",
              type: "richText",
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    AlignFeature(),
                    HeadingFeature({ enabledHeadingSizes: ["h2", "h3", "h4"] }),
                    BlocksFeature({ blocks: [Banner, Code, MediaBlock, SquiggleRule] }),
                    FixedToolbarFeature(),
                    InlineToolbarFeature(),
                    HorizontalRuleFeature(),
                    UnorderedListFeature(),
                    OrderedListFeature(),
                    IndentFeature(),
                    BlockquoteFeature(),
                  ]
                },
              }),
              label: "Editor's Note",
            },
            {
              name: "articles",
              type: "relationship",
              hasMany: true,
              relationTo: "articles",
              admin: {
                description: "Select and order articles for this volume",
                allowCreate: false,
                isSortable: true,
                sortOptions: "-publishedAt",
              },
              validate: checkArticles,
            },
          ],
          label: "Content",
        },
        seoTab(),
      ],
    },
    {
      name: "publishedAt",
      type: "date",
      admin: {
        date: {
          pickerAppearance: "dayAndTime",
        },
        position: "sidebar",
      },
      hooks: {
        beforeChange: [setPublishedAtDefault],
      },
    },
    slugField({
      useAsSlug: "volumeNumber",
      slugify: ({ valueToSlugify }) => String(valueToSlugify || ""),
    }),
  ],
  hooks: {
    afterChange: [revalidateVolume, pushToWebhooks],
    afterDelete: [revalidateDelete],
    beforeChange: [setDefaultSeoTitle],
  },
  versions: draftVersions,
}
