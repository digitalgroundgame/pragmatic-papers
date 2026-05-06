import { authenticatedOrPublished } from "@/access/authenticatedOrPublished"
import { editorFieldLevel } from "@/access/editor"
import { editorOrSelf, restrictWritersToDraftOnly } from "@/access/editorOrSelf"
import { writer } from "@/access/writer"
import { Banner } from "@/blocks/Banner/config"
import { Code } from "@/blocks/Code/config"
import { FootnoteBlock } from "@/blocks/Footnote/config"
import { FootnoteShortcutFeature } from "@/blocks/Footnote/shortcutFeature"
import { DisplayMathBlock, InlineMathBlock } from "@/blocks/Math/config"
import { MediaBlock } from "@/blocks/MediaBlock/config"
import { MediaCollageBlock } from "@/blocks/MediaCollageBlock/config"
import { SocialEmbed } from "@/blocks/SocialEmbed/config"
import { LegacyBlueskyEmbed } from "@/blocks/SocialEmbed/embeds/BlueskyEmbed/config"
import { LegacyRedditEmbed } from "@/blocks/SocialEmbed/embeds/RedditEmbed/config"
import { LegacyTikTokEmbed } from "@/blocks/SocialEmbed/embeds/TikTokEmbed/config"
import { LegacyTwitterEmbed } from "@/blocks/SocialEmbed/embeds/TwitterEmbed/config"
import { LegacyYouTubeEmbed } from "@/blocks/SocialEmbed/embeds/YouTubeEmbed/config"
import { SquiggleRule } from "@/blocks/SquiggleRule/config"
import { Timeline } from "@/blocks/Timeline/config"
import { detectMathBlocks } from "@/collections/Articles/hooks/detectMathBlocks"
import { generateFootnotes } from "@/collections/Articles/hooks/generateFootnotes"
import { populateAuthors } from "@/collections/Articles/hooks/populateAuthors"
import { populateMetaImageFromHero } from "@/collections/Articles/hooks/populateMetaImageFromHero"
import { populateNarrator } from "@/collections/Articles/hooks/populateNarrator"
import { populateVolume } from "@/collections/Articles/hooks/populateVolume"
import { revalidateArticle, revalidateDelete } from "@/collections/Articles/hooks/revalidateArticle"
import { footnotesArrayField } from "@/fields/footnotes"
import { menu } from "@/fields/menu"
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
    create: writer,
    delete: editorOrSelf,
    read: authenticatedOrPublished,
    update: restrictWritersToDraftOnly,
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
                      blocks: [
                        Banner,
                        Code,
                        MediaBlock,
                        MediaCollageBlock,
                        DisplayMathBlock,
                        SquiggleRule,
                        SocialEmbed,
                        Timeline,
                        // Legacy blocks for backward compatibility with existing content
                        LegacyBlueskyEmbed,
                        LegacyRedditEmbed,
                        LegacyTikTokEmbed,
                        LegacyTwitterEmbed,
                        LegacyYouTubeEmbed,
                      ],
                      inlineBlocks: [InlineMathBlock, FootnoteBlock],
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
      filterOptions: {
        role: {
          in: ["writer", "editor", "chief-editor"],
        },
      },
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
      name: "narration",
      type: "upload",
      admin: {
        position: "sidebar",
      },
      filterOptions: {
        mimeType: {
          contains: "audio",
        },
      },
      relationTo: "media",
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
    // This field is only used to populate the user data via the `populateAuthors` hook
    // This is because the `user` collection has access control locked to protect user privacy
    // GraphQL will also not return mutated user data that differs from the underlying schema
    {
      name: "populatedAuthors",
      interfaceName: "PopulatedAuthors",
      type: "array",
      access: {
        update: () => false,
      },
      admin: {
        disabled: true,
        readOnly: true,
      },
      fields: [
        {
          name: "id",
          type: "text",
          required: true,
        },
        {
          name: "name",
          type: "text",
        },
        {
          name: "slug",
          type: "text",
          required: true,
        },
        {
          name: "affiliation",
          type: "text",
        },
        {
          name: "biography",
          type: "richText",
        },
        {
          name: "profileImage",
          type: "upload",
          relationTo: "media",
        },
        menu({
          name: "socials",
          label: "Socials",
          maxRows: 6,
        }),
      ],
    },
    {
      name: "populatedVolume",
      interfaceName: "PopulatedVolume",
      type: "group",
      virtual: true,
      access: {
        update: () => false,
      },
      admin: {
        disabled: true,
        readOnly: true,
      },
      fields: [
        { name: "id", type: "number" },
        { name: "slug", type: "text" },
        { name: "volumeNumber", type: "number" },
        { name: "title", type: "text" },
        { name: "publishedAt", type: "date" },
      ],
    },
    {
      name: "populatedNarrator",
      interfaceName: "PopulatedNarrator",
      type: "group",
      virtual: true,
      access: {
        update: () => false,
      },
      admin: {
        disabled: true,
        readOnly: true,
      },
      fields: [
        { name: "id", type: "number" },
        { name: "name", type: "text" },
        { name: "slug", type: "text" },
      ],
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
    afterRead: [populateAuthors, populateVolume, populateNarrator],
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
