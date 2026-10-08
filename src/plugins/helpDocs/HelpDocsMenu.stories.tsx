import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, fn, userEvent, waitFor, within } from "storybook/test"

import type { HelpDoc } from "@/docs"
import { withPayloadAdminTheme } from "@/stories/payloadAdminTheme"

import { HelpDocsMenu } from "./HelpDocsMenu"

const docs: HelpDoc[] = [
  {
    slug: "unsplash-photos",
    title: "Find a photo on Unsplash without leaving the admin",
    summary:
      "Search Unsplash from any Media upload. The photographer's credit goes into the caption for you.",
    publishedAt: "2026-10-18",
  },
  {
    slug: "experiments",
    title: "Switch beta features on per site in Site Settings",
    summary: "Experiments let a new feature run on staging before readers on the live site see it.",
    publishedAt: "2026-10-11",
    audience: ["admin"],
  },
]

const meta = {
  title: "Admin/HelpDocsMenu",
  component: HelpDocsMenu,
  decorators: [withPayloadAdminTheme],
  args: {
    docs,
    unread: ["unsplash-photos"],
    onOpenDoc: fn(),
    onMarkAllRead: fn(),
  },
} satisfies Meta<typeof HelpDocsMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Unread: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const bell = canvas.getByRole("button", { name: "Help docs, 1 unread" })
    await userEvent.click(bell)

    const article = await canvas.findByRole("link", {
      name: /Find a photo on Unsplash.*\(unread\)/,
    })
    await waitFor(() => expect(article).toBeVisible())
    await expect(article).toHaveAttribute("href", "/docs/unsplash-photos")
    await expect(canvas.getByRole("link", { name: "All help docs" })).toHaveAttribute(
      "href",
      "/docs",
    )

    await userEvent.click(canvas.getByRole("button", { name: "Mark all as read" }))
    await expect(args.onMarkAllRead).toHaveBeenCalledOnce()
  },
}

export const AllRead: Story = {
  args: { unread: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Help docs" }))
    await waitFor(() =>
      expect(canvas.getByRole("link", { name: /Switch beta features/ })).toBeVisible(),
    )
    await expect(canvas.queryByRole("button", { name: "Mark all as read" })).not.toBeInTheDocument()
  },
}
