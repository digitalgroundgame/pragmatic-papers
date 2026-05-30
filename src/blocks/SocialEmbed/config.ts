import { derivePlatform } from "@/blocks/SocialEmbed/hooks/derivePlatform"
import { fetchSnapshot } from "@/blocks/SocialEmbed/hooks/fetchSnapshot"
import { validatePlatform } from "@/blocks/SocialEmbed/hooks/validatePlatform"
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
      options: ["bluesky", "reddit", "tiktok", "twitter", "youtube"],
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
      fields: [
        {
          name: "status",
          type: "select",
          options: [
            "ok",
            "not_found",
            "forbidden",
            "error",
            "timeout",
            "aborted",
            "invalid_oembed_response",
          ],
        },
        { name: "fetchedAt", type: "date", label: "Fetched At" },
        { name: "providerName", type: "text", label: "Provider Name" },
        { name: "providerURL", type: "text", label: "Provider URL" },
        { name: "authorName", type: "text", label: "Author Name" },
        { name: "authorURL", type: "text", label: "Author URL" },
        { name: "title", type: "text", label: "Title" },
        { name: "html", type: "text", label: "HTML" },
        { name: "thumbnailURL", type: "text", label: "Thumbnail URL" },
      ],
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
