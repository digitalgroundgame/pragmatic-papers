import type { Block } from "payload"

import { blockImages } from "@/blocks/blockImages"

/**
 * Legacy config for TikTok embeds.
 * @deprecated Use the SocialEmbed block instead.
 * @see SocialEmbedBlock
 */
export const LegacyTikTokEmbed: Block = {
  slug: "tiktokEmbed",
  // interfaceName: 'TikTokEmbedBlock',
  labels: {
    singular: "TikTok Embed (Legacy)",
    plural: "TikTok Embeds (Legacy)",
  },
  admin: {
    images: blockImages("tiktokEmbed"),
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
