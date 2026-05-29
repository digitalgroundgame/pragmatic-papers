import type { Block, Field } from "payload"

import {
  AlignFeature,
  BlocksFeature,
  EXPERIMENTAL_TableFeature,
  FixedToolbarFeature,
  HeadingFeature,
  IndentFeature,
  InlineToolbarFeature,
  lexicalEditor,
  UnorderedListFeature,
  OrderedListFeature,
} from "@payloadcms/richtext-lexical"

import { CallToAction } from "@/blocks/CallToAction/config"
import { NewsletterSignup } from "@/blocks/NewsletterSignup/config"
import { link } from "@/fields/link"

const columnFields: Field[] = [
  {
    name: "size",
    type: "select",
    defaultValue: "oneThird",
    options: [
      {
        label: "One Third",
        value: "oneThird",
      },
      {
        label: "Half",
        value: "half",
      },
      {
        label: "Two Thirds",
        value: "twoThirds",
      },
      {
        label: "Full",
        value: "full",
      },
    ],
  },
  {
    name: "richText",
    type: "richText",
    editor: lexicalEditor({
      features: ({ rootFeatures }) => {
        return [
          ...rootFeatures,
          HeadingFeature({ enabledHeadingSizes: ["h2", "h3", "h4"] }),
          FixedToolbarFeature(),
          InlineToolbarFeature(),
          IndentFeature(),
          UnorderedListFeature(),
          OrderedListFeature(),
          AlignFeature(),
          EXPERIMENTAL_TableFeature(),
          BlocksFeature({ blocks: [CallToAction, NewsletterSignup] }),
        ]
      },
    }),
    label: false,
  },
  {
    name: "enableLink",
    type: "checkbox",
  },
  link({
    overrides: {
      admin: {
        condition: (_data, siblingData) => {
          return Boolean(siblingData?.enableLink)
        },
      },
    },
  }),
]

export const Content: Block = {
  slug: "content",
  interfaceName: "ContentBlock",
  fields: [
    {
      name: "width",
      type: "select",
      defaultValue: "narrow",
      options: [
        { label: "Narrow", value: "narrow" },
        { label: "Wide", value: "wide" },
        { label: "Full", value: "full" },
      ],
    },
    {
      name: "columns",
      type: "array",
      admin: {
        initCollapsed: true,
      },
      fields: columnFields,
    },
  ],
}
