import type { Block } from "payload"

export const NewsletterSignup: Block = {
  slug: "newsletterSignup",
  interfaceName: "NewsletterSignupBlock",
  labels: {
    singular: "Newsletter Signup",
    plural: "Newsletter Signups",
  },
  fields: [
    {
      name: "heading",
      type: "text",
      defaultValue: "Get one article a weekday during each Volume",
    },
    {
      name: "description",
      type: "textarea",
      defaultValue:
        "When a new Volume drops, we send one article per weekday so you can actually read every piece. No spam, unsubscribe any time.",
    },
    {
      name: "buttonLabel",
      type: "text",
      defaultValue: "Subscribe",
    },
  ],
}
