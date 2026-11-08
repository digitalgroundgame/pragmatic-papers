import type { Block } from "payload"

import { lexicalEditor, LinkFeature } from "@payloadcms/richtext-lexical"

import { blockImages } from "@/blocks/blockImages"

export const NewsletterSignup: Block = {
  slug: "newsletterSignup",
  admin: { images: blockImages("newsletterSignup") },
  interfaceName: "NewsletterSignupBlock",
  labels: {
    singular: "Newsletter Signup",
    plural: "Newsletter Signups",
  },
  fields: [
    {
      name: "heading",
      type: "text",
      defaultValue: "Newsletter Signup",
    },
    {
      name: "description",
      type: "textarea",
    },
    {
      name: "buttonLabel",
      type: "text",
      defaultValue: "Subscribe",
    },
    {
      name: "notice",
      type: "richText",
      editor: lexicalEditor({
        features: () => [LinkFeature({ enabledCollections: [] })],
      }),
    },
  ],
}
