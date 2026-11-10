import type { GlobalConfig } from "payload"

import { isAdmin } from "@/access/roles"
import { publicationHost } from "@/integrations/substack"

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
      label: "YouTube channels",
      type: "group",
      admin: {
        description:
          "Shown in the ticker while one is live or about to be. When two are live at once, the first listed wins.",
      },
      fields: [
        {
          name: "channels",
          type: "array",
          labels: { singular: "Channel", plural: "Channels" },
          // `videos.list` reads at most 50 videos, ten from each channel.
          maxRows: 5,
          admin: {
            description: "Empty uses YOUTUBE_CHANNEL_IDS.",
            initCollapsed: false,
          },
          fields: [
            {
              name: "channelId",
              label: "Channel ID",
              type: "text",
              required: true,
              admin: {
                placeholder: "UC…",
                description: "From the channel's About page → Share channel → Copy channel ID.",
              },
              validate: (value: string | null | undefined) =>
                /^UC[\w-]{22}$/.test(value?.trim() ?? "") ||
                "A channel ID starts with UC and is 24 characters long.",
            },
          ],
        },
      ],
    },
    {
      name: "bluesky",
      label: "Bluesky accounts",
      type: "group",
      admin: { description: "Whose posts run in the ticker." },
      fields: [
        {
          name: "handles",
          type: "array",
          labels: { singular: "Account", plural: "Accounts" },
          maxRows: 5,
          admin: {
            description: "Empty uses BLUESKY_HANDLES, or thepragmaticpapers.bsky.social.",
            initCollapsed: false,
          },
          fields: [
            {
              name: "handle",
              type: "text",
              required: true,
              admin: { placeholder: "thepragmaticpapers.bsky.social" },
            },
          ],
        },
      ],
    },
    {
      name: "substack",
      label: "Substack publications",
      type: "group",
      admin: { description: "Whose posts run in the ticker." },
      fields: [
        {
          name: "types",
          label: "Post types",
          type: "select",
          hasMany: true,
          options: [
            { label: "Podcast episodes", value: "podcast" },
            { label: "Videos", value: "video" },
            { label: "Written posts", value: "post" },
          ],
          admin: {
            description:
              "Which of the publications' posts run in the ticker. Empty shows podcast episodes and videos: written posts are mostly our own articles, syndicated.",
          },
        },
        {
          name: "publications",
          type: "array",
          labels: { singular: "Publication", plural: "Publications" },
          maxRows: 5,
          admin: {
            description: "Empty uses SUBSTACK_PUBLICATIONS, or thepragmaticpapers.",
            initCollapsed: false,
          },
          fields: [
            {
              name: "publication",
              type: "text",
              required: true,
              admin: {
                placeholder: "thepragmaticpapers.substack.com",
                description:
                  "Its address, a custom domain, or its name. Posts are read from its RSS feed.",
              },
              validate: (value: string | null | undefined) =>
                publicationHost(value ?? "") !== "" ||
                "Enter the publication's address, like thepragmaticpapers.substack.com.",
            },
          ],
        },
      ],
    },
    {
      name: "x",
      label: "X accounts",
      type: "group",
      admin: { description: "Whose posts run in the ticker." },
      fields: [
        {
          name: "usernames",
          type: "array",
          labels: { singular: "Account", plural: "Accounts" },
          // Each account is two paid reads a check.
          maxRows: 5,
          admin: {
            description: "Empty uses X_USERNAMES, or PragPapers.",
            initCollapsed: false,
          },
          fields: [
            {
              name: "username",
              type: "text",
              required: true,
              admin: { placeholder: "PragPapers" },
            },
          ],
        },
      ],
    },
  ],
}
