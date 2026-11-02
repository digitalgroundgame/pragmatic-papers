import type { Block } from "payload"

import { blockImages } from "@/blocks/blockImages"

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
    images: blockImages("redditEmbed"),
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
