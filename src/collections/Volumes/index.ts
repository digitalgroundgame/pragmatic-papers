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
import { Banner } from "@/blocks/Banner/config"
import { Code } from "@/blocks/Code/config"
import { MediaBlock } from "@/blocks/MediaBlock/config"
import { SquiggleRule } from "@/blocks/SquiggleRule/config"

import { authenticatedOrPublished } from "@/access/authenticatedOrPublished"
import { generatePreviewPath } from "@/utilities/generatePreviewPath"
import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from "@payloadcms/plugin-seo/fields"
import { checkArticles } from "./hooks/checkArticles"
import { getNextVolumeNumber } from "./hooks/getNextVolumeNumber"
import { pushToWebhooks } from "./hooks/pushToWebhooks"
import { revalidateArticle, revalidateDelete } from "./hooks/revalidateVolumes"
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
    livePreview: {
      url: ({ data, req }) =>
        generatePreviewPath({
          slug: data?.slug,
          collection: "volumes",
          req,
        }),
    },
    preview: (data, { req }) =>
      generatePreviewPath({
        slug: data?.slug as string,
        collection: "volumes",
        req,
      }),
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
        {
          name: "meta",
          label: "SEO",
          fields: [
            OverviewField({
              titlePath: "meta.title",
              descriptionPath: "meta.description",
              imagePath: "meta.image",
            }),
            MetaTitleField({
              hasGenerateFn: true,
            }),
            MetaImageField({
              relationTo: "media",
            }),

            MetaDescriptionField({}),
            PreviewField({
              // if the `generateUrl` function is configured
              hasGenerateFn: true,

              // field paths to match the target field for data
              titlePath: "meta.title",
              descriptionPath: "meta.description",
            }),
          ],
        },
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
        beforeChange: [
          // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
          ({ siblingData, value }) => {
            if (siblingData._status === "published" && !value) {
              return new Date()
            }
            return value
          },
        ],
      },
    },
    slugField({
      useAsSlug: "volumeNumber",
      slugify: ({ valueToSlugify }) => String(valueToSlugify || ""),
    }),
  ],
  hooks: {
    afterChange: [revalidateArticle, pushToWebhooks],
    afterDelete: [revalidateDelete],
    beforeChange: [setDefaultSeoTitle],
  },
  versions: {
    drafts: {
      autosave: true,
      schedulePublish: true,
    },
    maxPerDoc: 50,
  },
}
