import type { GlobalConfig } from "payload"

import { isAdmin } from "@/access/roles"

import { revalidateIntegrations } from "./hooks/revalidateIntegrations"

/**
 * The site's outside connections: whether each is connected here, and the settings that aren't
 * secrets. Keys and tokens stay in the environment (`src/integrations/types.ts`), so this shows
 * which are missing by name and never stores one.
 */
export const Integrations: GlobalConfig = {
  slug: "integrations",
  // Not `Integration`, which is the connection contract in `src/integrations`.
  typescript: { interface: "IntegrationSettings" },
  access: {
    read: ({ req: { user } }) => isAdmin(user),
    update: ({ req: { user } }) => isAdmin(user),
  },
  admin: {
    group: "System",
    hidden: ({ user }) => !isAdmin(user),
    description:
      "Each environment keeps its own settings. Keys and tokens are set in the hosting environment, never here.",
  },
  hooks: {
    afterChange: [revalidateIntegrations],
  },
  fields: [
    {
      name: "status",
      type: "ui",
      admin: {
        components: {
          Field: "@/globals/Integrations/components/IntegrationStatusField#IntegrationStatusField",
        },
      },
    },
    {
      name: "youtube",
      label: "Podcast YouTube channel",
      type: "group",
      admin: { description: "Shown in the home page ticker while it's live or about to be." },
      fields: [
        {
          name: "channelId",
          label: "Channel ID",
          type: "text",
          admin: {
            placeholder: "UC…",
            description:
              "From the channel's About page → Share channel → Copy channel ID. Empty uses YOUTUBE_CHANNEL_ID.",
          },
          validate: (value: string | null | undefined) =>
            !value?.trim() ||
            /^UC[\w-]{22}$/.test(value.trim()) ||
            "A channel ID starts with UC and is 24 characters long.",
        },
      ],
    },
    {
      name: "bluesky",
      label: "Bluesky posts",
      type: "group",
      admin: { description: "Whose posts run in the home page ticker." },
      fields: [
        {
          name: "handle",
          type: "text",
          admin: {
            placeholder: "thepragmaticpapers.bsky.social",
            description: "Empty uses BLUESKY_HANDLE, or thepragmaticpapers.bsky.social.",
          },
        },
      ],
    },
    {
      name: "x",
      label: "X posts",
      type: "group",
      admin: { description: "Whose posts run in the home page ticker." },
      fields: [
        {
          name: "username",
          type: "text",
          admin: {
            placeholder: "PragPapers",
            description: "Empty uses X_USERNAME, or PragPapers.",
          },
        },
      ],
    },
  ],
}
