import type { Block } from "payload"

/**
 * Legacy config for YouTube embeds.
 * @deprecated Use the SocialEmbed block instead.
 * @see SocialEmbedBlock
 */
export const LegacyYouTubeEmbed: Block = {
  slug: "youtubeEmbed",
  // interfaceName: 'YouTubeEmbedBlock',
  labels: {
    singular: "YouTube Embed (Legacy)",
    plural: "YouTube Embeds (Legacy)",
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
