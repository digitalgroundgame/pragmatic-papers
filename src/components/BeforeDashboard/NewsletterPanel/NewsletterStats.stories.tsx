import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { withPayloadAdminTheme } from "@/stories/payloadAdminTheme"

import { NewsletterStats } from "./NewsletterStats"

const meta = {
  title: "Admin/Dashboard/NewsletterStats",
  component: NewsletterStats,
  decorators: [withPayloadAdminTheme],
  args: {
    overview: {
      connected: true,
      adminUrl: "https://list.example.com/admin",
      list: {
        ok: true,
        data: {
          name: "Newsletter",
          total: 1342,
          confirmed: 1204,
          unconfirmed: 61,
          unsubscribed: 77,
        },
      },
      signups: {
        ok: true,
        data: [
          {
            id: 3,
            email: "reader@example.com",
            createdAt: "2026-10-10T18:04:00Z",
            subscriptionStatus: "unconfirmed",
            status: "enabled",
          },
          {
            id: 2,
            email: "subscriber@example.org",
            createdAt: "2026-10-09T02:30:00Z",
            subscriptionStatus: "confirmed",
            status: "enabled",
          },
          {
            id: 1,
            email: "spam@example.net",
            createdAt: "2026-10-08T11:00:00Z",
            subscriptionStatus: "confirmed",
            status: "blocklisted",
          },
        ],
      },
      campaigns: {
        ok: true,
        data: [
          {
            id: 12,
            name: "Volume 41, Monday",
            subject: "The case for permitting reform",
            status: "scheduled",
            sendAt: "2026-10-12T14:00:00Z",
            sent: 0,
            toSend: 0,
            views: 0,
            clicks: 0,
            bounces: 0,
          },
          {
            id: 11,
            name: "Volume 40, Friday",
            subject: "What the jobs report says",
            status: "finished",
            sendAt: "2026-10-09T14:00:03Z",
            sent: 1198,
            toSend: 1198,
            views: 512,
            clicks: 87,
            bounces: 3,
          },
        ],
      },
    },
  },
} satisfies Meta<typeof NewsletterStats>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("Subscribers").nextSibling).toHaveTextContent("1,204")
    await expect(canvas.getByRole("link", { name: "Open Listmonk" })).toHaveAttribute(
      "href",
      "https://list.example.com/admin",
    )
    const signups = within(canvas.getByRole("table", { name: "Recent signups" }))
    await expect(signups.getByRole("row", { name: /spam@example\.net/ })).toHaveTextContent(
      "blocklisted",
    )
    const campaigns = within(canvas.getByRole("table", { name: "Recent campaigns" }))
    await expect(campaigns.getByRole("row", { name: /Volume 40/ })).toHaveTextContent("512 (43%)")
  },
}

export const Refused: Story = {
  args: {
    overview: {
      ...meta.args.overview,
      signups: { ok: false, reason: "forbidden" },
      campaigns: { ok: false, reason: "error" },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/isn't allowed to read subscribers/)).toHaveTextContent(
      "subscribers:get_all",
    )
    await expect(canvas.getByText(/Couldn't read campaigns/)).toBeInTheDocument()
    await expect(canvas.getByText("Subscribers")).toBeInTheDocument()
  },
}

export const NotConnected: Story = {
  args: { overview: { connected: false, missing: ["LISTMONK_BASE_URL", "LISTMONK_API_TOKEN"] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/isn't connected in this environment/)).toHaveTextContent(
      "LISTMONK_BASE_URL, LISTMONK_API_TOKEN",
    )
    await expect(canvas.queryByRole("link", { name: "Open Listmonk" })).not.toBeInTheDocument()
  },
}
