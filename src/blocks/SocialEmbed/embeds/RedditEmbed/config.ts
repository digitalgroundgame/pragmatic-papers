import type { Block } from "payload"

import { blockDescriptionField } from "@/fields/blockDescription"

/**
 * Legacy config for Reddit embeds.
 * @deprecated Use the SocialEmbed block instead.
 * @see SocialEmbedBlock
 */
export const LegacyRedditEmbed: Block = {
  slug: "redditEmbed",
  // interfaceName: 'RedditEmbedBlock',
  labels: {
    singular: "Reddit Embed (Legacy)",
    plural: "Reddit Embeds (Legacy)",
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
