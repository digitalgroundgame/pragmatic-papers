import type { Block } from "payload"

/**
 * Legacy config for Twitter embeds.
 * @deprecated Use the SocialEmbed block instead.
 * @see SocialEmbedBlock
 */
export const LegacyTwitterEmbed: Block = {
  slug: "twitterEmbed",
  // interfaceName: 'TwitterOEmbedBlock',
  labels: {
    singular: "Twitter Embed (Legacy)",
    plural: "Twitter Embeds (Legacy)",
  },
  admin: {
    group: "Legacy",
  },
  fields: [
    {
      name: "url",
      type: "text",
      required: true,
    },
    {
      name: "hideMedia",
      type: "checkbox",
    },
    {
      name: "hideThread",
      type: "checkbox",
    },
  ],
}
