import type { CollectionConfig } from "payload"

import { isPublishedOrStaff } from "@/access/policies"
import { CollectionGrid } from "@/blocks/CollectionGrid/config"
import { CallToAction } from "@/blocks/CallToAction/config"
import { Content } from "@/blocks/Content/config"
import { Contributors } from "@/blocks/Contributors/config"
import { FeedsList } from "@/blocks/FeedsList/config"
import { FormBlock } from "@/blocks/Form/config"
import { MediaBlock } from "@/blocks/MediaBlock/config"
import { Merch } from "@/blocks/Merch/config"
import { NewsletterSignup } from "@/blocks/NewsletterSignup/config"
import { Timeline } from "@/blocks/Timeline/config"
import { TopicsList } from "@/blocks/TopicsList/config"
import { VolumeView } from "@/blocks/VolumeViewBlock/config"
import { hero } from "@/heros/config"
import { populatePublishedAt } from "@/hooks/populatePublishedAt"
import { revalidateNavLinks, revalidateNavLinksDelete } from "@/hooks/revalidateNavLinks"
import { generatePreviewPath } from "@/utilities/generatePreviewPath"
import { rememberReadersCopy } from "@/utilities/readersCopy"
import { slugField } from "payload"
import { revalidateDelete, revalidatePage } from "./hooks/revalidatePage"
import { deletePageAccess, lockSitePageSlug, sitePageKeyField } from "./sitePages"
import { asideField } from "@/globals/Layouts/config"

import { admin } from "@/access/collections"
import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from "@payloadcms/plugin-seo/fields"

const LAYOUT_BLOCKS = [
  CollectionGrid,
  CallToAction,
  Content,
  Contributors,
  MediaBlock,
  NewsletterSignup,
  Merch,
  Timeline,
  VolumeView,
  FormBlock,
  FeedsList,
].map((block) => block.slug)

export const Pages: CollectionConfig<"pages"> = {
  slug: "pages",
  access: {
    create: admin,
    delete: deletePageAccess,
    read: isPublishedOrStaff,
    update: admin,
  },
  // This config controls what's populated by default when a page is referenced
  // https://payloadcms.com/docs/queries/select#defaultpopulate-collection-config-property
  // Type safe if the collection slug generic is passed to `CollectionConfig` - `CollectionConfig<'pages'>
  defaultPopulate: {
    title: true,
    slug: true,
    // So a nav link to an unpublished page can be left out (`linksToUnpublished`).
    _status: true,
  },
  admin: {
    group: "Site",
    defaultColumns: ["title", "slug", "updatedAt"],
    livePreview: {
      url: ({ data, req }) =>
        generatePreviewPath({
          slug: data?.slug,
          collection: "pages",
          req,
        }),
    },
    preview: (data, { req }) =>
      generatePreviewPath({
        slug: data?.slug as string,
        collection: "pages",
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
    {
      type: "tabs",
      tabs: [
        {
          fields: [hero],
          label: "Hero",
        },
        {
          fields: [
            {
              name: "layout",
              type: "blocks",
              blocks: [
                CollectionGrid,
                CallToAction,
                Content,
                Contributors,
                MediaBlock,
                NewsletterSignup,
                Merch,
                Timeline,
                VolumeView,
                FormBlock,
                FeedsList,
                TopicsList,
              ],
              // A list only a site page's route can page through goes on that page alone.
              filterOptions: ({ data }) =>
                data?.key === "topics"
                  ? true
                  : LAYOUT_BLOCKS.filter((slug) => slug !== "topicsList"),
              required: true,
              admin: {
                initCollapsed: true,
              },
            },
          ],
          label: "Content",
        },
        {
          label: "Aside",
          admin: {
            description: "The panels beside the page's content, below it on phones.",
            condition: (data) => Boolean(data?.key),
          },
          fields: [asideField({})],
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
      ],
    },
    {
      name: "publishedAt",
      type: "date",
      admin: {
        position: "sidebar",
      },
    },
    sitePageKeyField,
    slugField({ overrides: lockSitePageSlug }),
  ],
  hooks: {
    afterChange: [revalidatePage, revalidateNavLinks],
    beforeChange: [rememberReadersCopy, populatePublishedAt],
    afterDelete: [revalidateDelete, revalidateNavLinksDelete],
  },
  versions: {
    drafts: {
      autosave: true,
      schedulePublish: true,
    },
    maxPerDoc: 50,
  },
}
