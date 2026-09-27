import { isPublishedOrStaff, isCreatedByOrEditor, isDraftOrEditor } from "@/access/policies"
import { writerOrEditor } from "@/access/collections"
import { editorFieldLevel } from "@/access/fields"
import { AUTHOR_ROLES } from "@/access/roles"
import { FootnoteShortcutFeature } from "@/blocks/Footnote/shortcutFeature"
import { articleContentBlocks, articleInlineBlocks } from "@/collections/Articles/contentBlocks"
import { detectMathBlocks } from "@/collections/Articles/hooks/detectMathBlocks"
import { generateFootnotes } from "@/collections/Articles/hooks/generateFootnotes"
import { populateTopics } from "@/collections/Articles/hooks/populateTopics"
import { populateMetaImageFromHero } from "@/collections/Articles/hooks/populateMetaImageFromHero"
import { revalidateArticle, revalidateDelete } from "@/collections/Articles/hooks/revalidateArticle"
import { footnotesArrayField } from "@/fields/footnotes"
import { type Article } from "@/payload-types"
import { generatePreviewPath } from "@/utilities/generatePreviewPath"

import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from "@payloadcms/plugin-seo/fields"
import {
  AlignFeature,
  BlockquoteFeature,
  BlocksFeature,
  ChecklistFeature,
  EXPERIMENTAL_TableFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  IndentFeature,
  InlineToolbarFeature,
  lexicalEditor,
  OrderedListFeature,
  StrikethroughFeature,
  SubscriptFeature,
  SuperscriptFeature,
  UnorderedListFeature,
} from "@payloadcms/richtext-lexical"
import type { CollectionBeforeChangeHook, CollectionConfig, FieldHook } from "payload"
import { slugField } from "payload"

const setPublishedAtDefault: FieldHook<Article, Article["publishedAt"]> = ({
  siblingData,
  value,
}) => {
  if (siblingData && siblingData._status === "published" && !value) {
    return new Date().toISOString()
  }

  return value
}

export const Articles: CollectionConfig = {
  slug: "articles",
  access: {
    create: writerOrEditor,
    delete: isCreatedByOrEditor,
    read: isPublishedOrStaff,
    update: isDraftOrEditor,
  },
  admin: {
    defaultColumns: ["title", "slug", "updatedAt"],
    livePreview: {
      url: ({ data, req }) =>
        generatePreviewPath({
          slug: data?.slug,
          collection: "articles",
          req,
        }),
    },
    preview: (data, { req }) =>
      generatePreviewPath({
        slug: data?.slug as string,
        collection: "articles",
        req,
      }),
    useAsTitle: "title",
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
    },
    // START TABS FIELDS
    {
      type: "tabs",
      tabs: [
        {
          fields: [
            {
              name: "content",
              type: "richText",
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    AlignFeature(),
                    HeadingFeature({ enabledHeadingSizes: ["h2", "h3", "h4"] }),
                    BlocksFeature({
                      blocks: articleContentBlocks,
                      inlineBlocks: articleInlineBlocks,
                    }),
                    FootnoteShortcutFeature(),
                    FixedToolbarFeature(),
                    InlineToolbarFeature(),
                    HorizontalRuleFeature(),
                    BlockquoteFeature(),
                    EXPERIMENTAL_TableFeature(),
                    StrikethroughFeature(),
                    SubscriptFeature(),
                    SuperscriptFeature(),
                    IndentFeature(),
                    UnorderedListFeature(),
                    OrderedListFeature(),
                    ChecklistFeature(),
                  ]
                },
              }),
              label: false,
              required: true,
            },
            footnotesArrayField(),
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

            MetaDescriptionField({
              hasGenerateFn: true,
            }),
            PreviewField({
              // if the `generateUrl` function is configured
              hasGenerateFn: true,

              // field paths to match the target field for data
              titlePath: "meta.title",
              descriptionPath: "meta.description",
            }),
          ],
        },
        {
          label: "Narration",
          fields: [
            {
              name: "narration",
              type: "upload",
              label: "Audio File",
              filterOptions: {
                mimeType: {
                  contains: "audio",
                },
              },
              relationTo: "media",
            },
            {
              name: "extractNarration",
              type: "ui",
              admin: {
                components: {
                  Field:
                    "@/collections/Articles/components/ExtractNarrationButton#ExtractNarrationButton",
                },
              },
            },
          ],
        },
      ],
    },
    // END TABS FIELDS
    {
      name: "heroImage",
      type: "upload",
      relationTo: "media",
      admin: {
        position: "sidebar",
      },
    },
    slugField(),
    {
      name: "enableMathRendering",
      type: "checkbox",
      defaultValue: false,
      admin: {
        hidden: true,
      },
    },
    {
      name: "publishedAt",
      type: "date",
      access: {
        update: editorFieldLevel,
      },
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
    {
      name: "authors",
      type: "relationship",
      admin: {
        position: "sidebar",
      },
      hasMany: true,
      relationTo: "users",
      filterOptions: { roles: { in: AUTHOR_ROLES } },
    },
    {
      name: "topics",
      type: "relationship",
      admin: {
        position: "sidebar",
      },
      hasMany: true,
      relationTo: "topics",
    },
    {
      name: "createdBy",
      type: "relationship",
      relationTo: "users",
      access: {
        update: () => false,
      },
      admin: {
        readOnly: true,
        hidden: true,
      },
    },
  ],
  hooks: {
    beforeChange: [
      (args: Parameters<CollectionBeforeChangeHook<Article>>[0]): Partial<Article> | void => {
        const { req, operation, data } = args
        if (operation === "create") {
          if (req.user) {
            data.createdBy = req.user.id
            return data
          }
        }
      },
      generateFootnotes,
      detectMathBlocks,
      populateMetaImageFromHero,
    ],
    afterChange: [revalidateArticle],
    afterRead: [populateTopics],
    afterDelete: [revalidateDelete],
  },
  versions: {
    drafts: {
      autosave: true,
      schedulePublish: true,
    },
    maxPerDoc: 50,
  },
}
