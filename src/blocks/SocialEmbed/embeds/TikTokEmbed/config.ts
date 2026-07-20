import type { Block } from "payload"

import { blockDescriptionField } from "@/fields/blockDescription"

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
    group: "Legacy",
  },
  fields: [
    blockDescriptionField(),
    {
      name: "url",
      type: "text",
      required: true,
    },
  ],
}
