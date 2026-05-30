import type { Block } from "payload"

/**
 * Legacy config for Bluesky embeds.
 * @deprecated Use the SocialEmbed block instead.
 * @see SocialEmbedBlock
 */
export const LegacyBlueskyEmbed: Block = {
  slug: "blueSkyEmbed",
  // interfaceName: 'BlueSkyEmbedBlock',
  labels: {
    singular: "Bluesky Embed (Legacy)",
    plural: "Bluesky Embeds (Legacy)",
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
  ],
}
