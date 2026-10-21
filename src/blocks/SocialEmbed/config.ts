import { derivePlatform } from "@/blocks/SocialEmbed/hooks/derivePlatform"
import { fetchSnapshot } from "@/blocks/SocialEmbed/hooks/fetchSnapshot"
import { validatePlatform } from "@/blocks/SocialEmbed/hooks/validatePlatform"
import { snapshotFields } from "@/blocks/SocialEmbed/snapshotFields"
import { SOCIAL_PLATFORMS } from "@/blocks/SocialEmbed/types"
import type { Block } from "payload"

export const SocialEmbed: Block = {
  slug: "socialEmbed",
  interfaceName: "SocialEmbedBlock",
  labels: {
    singular: "Social Embed",
    plural: "Social Embeds",
  },
  fields: [
    {
      name: "url",
      type: "text",
      required: true,
      label: "URL",
      admin: {
        description: "Paste a Twitter/X, YouTube, Reddit, BlueSky, or TikTok URL.",
        components: {
          Field: {
            path: "@/blocks/SocialEmbed/components/URLField#URLField",
          },
        },
      },
      hooks: {
        beforeChange: [derivePlatform, fetchSnapshot],
      },
    },
    {
      name: "platform",
      type: "select",
      interfaceName: "SocialPlatform",
      options: [...SOCIAL_PLATFORMS],
      required: true,
      hasMany: false,
      validate: validatePlatform,
      admin: {
        hidden: true,
        readOnly: true,
      },
    },
    {
      name: "snapshot",
      type: "group",
      interfaceName: "SocialEmbedSnapshot",
      fields: snapshotFields,
      admin: {
        hidden: true,
        readOnly: true,
      },
    },
    // Legacy fields
    {
      name: "hideMedia",
      type: "checkbox",
      label: "Hide Media",
      admin: {
        condition: (_: Record<string, unknown>, siblingData: Record<string, unknown>): boolean => {
          return siblingData.platform === "twitter"
        },
      },
    },
    {
      name: "hideThread",
      type: "checkbox",
      label: "Hide Thread",
      admin: {
        condition: (_: Record<string, unknown>, siblingData: Record<string, unknown>): boolean => {
          return siblingData.platform === "twitter"
        },
      },
    },
  ],
}
