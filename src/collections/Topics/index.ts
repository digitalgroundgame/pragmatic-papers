import { anyone } from "@/access/anyone"
import { editor } from "@/access/editor"
import { writer } from "@/access/writer"
import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from "@payloadcms/plugin-seo/fields"
import type { CollectionConfig } from "payload"
import { slugField } from "payload"

export const Topics: CollectionConfig = {
  slug: "topics",
  access: {
    create: writer,
    delete: editor,
    read: anyone,
    update: editor,
  },
  admin: {
    defaultColumns: ["name", "slug", "updatedAt"],
    useAsTitle: "name",
  },
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          label: "Content",
          fields: [
            {
              name: "name",
              type: "text",
              required: true,
              unique: true,
            },
            {
              name: "description",
              type: "textarea",
              admin: {
                description: "Optional description for this topic",
              },
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
            MetaTitleField({
              hasGenerateFn: true,
            }),
            MetaImageField({
              relationTo: "media",
            }),
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
    slugField({ useAsSlug: "name" }),
  ],
}
