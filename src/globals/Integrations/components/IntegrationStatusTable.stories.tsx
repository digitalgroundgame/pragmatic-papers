import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { withPayloadAdminTheme } from "@/stories/payloadAdminTheme"

import { IntegrationStatusTable } from "./IntegrationStatusTable"

const meta = {
  title: "Admin/Integrations/IntegrationStatusTable",
  component: IntegrationStatusTable,
  decorators: [withPayloadAdminTheme],
  args: {
    statuses: [
      {
        id: "youtube-podcast",
        label: "Podcast YouTube channel",
        service: "YouTube",
        target: "youtube:(channel set in the admin)",
        configured: false,
        missing: ["YOUTUBE_API_KEY"],
        unset: ["YOUTUBE_CHANNEL_ID"],
      },
      {
        id: "bluesky-posts",
        label: "Bluesky posts",
        service: "Bluesky",
        target: "bluesky:@thepragmaticpapers.bsky.social",
        configured: true,
        missing: [],
        unset: ["BLUESKY_HANDLE"],
      },
      {
        id: "cloudflare-cache",
        label: "Cloudflare edge cache",
        service: "Cloudflare",
        target: "cloudflare:zone",
        configured: true,
        missing: [],
        unset: [],
      },
    ],
  },
} satisfies Meta<typeof IntegrationStatusTable>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const youtube = canvas.getByRole("row", { name: /Podcast YouTube channel/ })
    await expect(youtube).toHaveTextContent("Not connected")
    await expect(youtube).toHaveTextContent("Required: YOUTUBE_API_KEY")
    await expect(canvas.getByRole("row", { name: /Cloudflare/ })).toHaveTextContent("Nothing")
  },
}
