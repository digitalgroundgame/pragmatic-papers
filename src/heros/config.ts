import type { Field } from "payload"

import {
  FixedToolbarFeature,
  HeadingFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from "@payloadcms/richtext-lexical"

import { menu } from "@/fields/menu"

export const hero: Field = {
  name: "hero",
  type: "group",
  fields: [
    {
      name: "type",
      type: "select",
      defaultValue: "lowImpact",
      label: "Type",
      options: [
        {
          label: "None",
          value: "none",
        },
        {
          label: "Page Hero",
          value: "pageHero",
        },
        {
          label: "High Impact",
          value: "highImpact",
        },
        {
          label: "Medium Impact",
          value: "mediumImpact",
        },
        {
          label: "Low Impact",
          value: "lowImpact",
        },
      ],
      required: true,
    },
    {
      name: "richText",
      type: "richText",
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [
            ...rootFeatures,
            HeadingFeature({ enabledHeadingSizes: ["h1", "h2", "h3", "h4"] }),
            FixedToolbarFeature(),
            InlineToolbarFeature(),
          ]
        },
      }),
      label: false,
    },
    menu({
      name: "links",
      label: "Links",
      maxRows: 2,
      // Hero links render as buttons, so a new one starts as the filled button.
      link: { component: { variant: { defaultValue: "default" } } },
    }),
    {
      name: "media",
      type: "upload",
      admin: {
        condition: (_, { type } = {}) => ["highImpact", "mediumImpact"].includes(type),
      },
      relationTo: "media",
      required: true,
    },
  ],
  label: false,
}
