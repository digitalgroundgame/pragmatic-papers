import type { CollectionConfig } from "payload"

import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from "@payloadcms/plugin-seo/fields"
import { slugField } from "payload"

import { editor } from "@/access/collections"
import { isPublishedOrStaff } from "@/access/policies"
import { link } from "@/fields/link2"
import { populatePublishedAt } from "@/hooks/populatePublishedAt"
import { profileOptions } from "@/interactives/profiles"
import { generatePreviewPath } from "@/utilities/generatePreviewPath"

import { revalidateInteractive, revalidateInteractiveDelete } from "./hooks/revalidateInteractive"

/**
 * Interactives — long-lived interactive pages, one per document, at /interactives/<slug>.
 *
 * This is the editorial half of an interactive: the title, standfirst and sources, which
 * code-owned profile draws it, and how its data feed is read. The data itself lives in
 * `interactive-snapshots`, written by the sync job; the layout, colours and geometry live in
 * code under `src/interactives/<profile>`. An editor here never touches data and a researcher
 * never touches layout — see `src/interactives/types.ts` for the rule.
 */
export const Interactives: CollectionConfig<"interactives"> = {
  slug: "interactives",
  labels: {
    singular: "Interactive",
    plural: "Interactives",
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
    defaultColumns: ["title", "slug", "profile", "updatedAt"],
    description:
      "Interactive pages drawn by a code-owned profile from a researcher's data feed. Editors own the words, the sources and when a data snapshot goes live; the feed owns the numbers.",
    group: "Interactives",
    livePreview: {
      url: ({ data, req }) =>
        generatePreviewPath({ slug: data?.slug, collection: "interactives", req }),
    },
    preview: (data, { req }) =>
      generatePreviewPath({ slug: data?.slug as string, collection: "interactives", req }),
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
          label: "Content",
          fields: [
            {
              name: "profile",
              type: "select",
              required: true,
              options: profileOptions(),
              admin: {
                description:
                  "Which code-owned profile draws this interactive: its geometry, presentation and feed adapter. Adding one is a code change under src/interactives.",
              },
            },
            {
              name: "intro",
              type: "richText",
              admin: {
                description: "Standfirst shown above the interactive.",
              },
            },
            {
              name: "sources",
              type: "array",
              label: "Sources / Attribution",
              labels: { singular: "Source", plural: "Sources" },
              admin: {
                description: "Shown as a small attribution footer beneath the interactive.",
              },
              fields: [
                link({
                  label: "Source",
                  component: {
                    type: { defaultValue: "custom" },
                    label: { label: "Name" },
                    variant: { admin: { hidden: true } },
                  },
                }),
              ],
            },
          ],
        },
        {
          label: "Data feed",
          fields: [
            {
              name: "feed",
              type: "group",
              admin: {
                description:
                  "How the sync job reads this interactive's data. It runs daily and can be run now from Interactive Snapshots. Each run that finds new data writes a draft snapshot for review; auto-publish skips the review.",
              },
              fields: [
                {
                  name: "enabled",
                  type: "checkbox",
                  defaultValue: true,
                  admin: { description: "Uncheck to freeze the data at its current snapshot." },
                },
                {
                  name: "ref",
                  type: "text",
                  required: true,
                  defaultValue: "main",
                  admin: {
                    description:
                      "Branch, tag or commit of the researcher's repository to read. A tag pins the data; a branch follows their latest.",
                  },
                },
                {
                  name: "autoPublish",
                  type: "checkbox",
                  defaultValue: false,
                  label: "Auto-publish new snapshots",
                  admin: {
                    description:
                      "Publish each new snapshot as soon as it validates, without an editor's review.",
                  },
                },
              ],
            },
          ],
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
            MetaTitleField({ hasGenerateFn: true }),
            MetaImageField({ relationTo: "media" }),
            MetaDescriptionField({}),
            PreviewField({
              hasGenerateFn: true,
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
      admin: { position: "sidebar" },
    },
    slugField(),
  ],
  hooks: {
    afterChange: [revalidateInteractive],
    beforeChange: [populatePublishedAt],
    afterDelete: [revalidateInteractiveDelete],
  },
  versions: {
    drafts: {
      autosave: true,
      schedulePublish: true,
    },
    maxPerDoc: 50,
  },
}
