import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test"

import { NotificationsMenu } from "./NotificationsMenu"
import type { NotificationItem } from "./types"

const items: NotificationItem[] = [
  {
    type: "docs",
    id: "unsplash-photos",
    title: "Find a photo on Unsplash without leaving the admin",
    summary:
      "Search Unsplash from any Media upload. The photographer's credit goes into the caption for you.",
    href: "/docs/unsplash-photos",
    date: "2026-10-18T00:00:00.000Z",
    image: {
      url: "/docs-assets/media/unsplash-photos-hero.webp",
      alt: "The Unsplash search in Media uploads with a grid of photos",
    },
  },
  {
    type: "docs",
    id: "experiments",
    title: "Switch beta features on per site in Settings",
    summary: "Experiments let a new feature run on staging before readers on the live site see it.",
    href: "/docs/experiments",
    date: "2026-10-11T00:00:00.000Z",
    image: {
      url: "/docs-assets/site/experiments-hero.webp",
      alt: "The Site Settings switch for the Ticker experiment, turned on",
    },
  },
]

const meta = {
  title: "Admin/NotificationsMenu",
  component: NotificationsMenu,
  args: {
    items,
    unread: ["docs:unsplash-photos"],
    types: [
      {
        slug: "docs",
        label: "Docs",
        description: "New features in the admin, and how to use them.",
      },
    ],
    muted: [],
    indexes: [{ type: "docs", label: "All docs", href: "/docs" }],
    onOpen: fn(),
    onMarkAllRead: fn(),
    onMutedChange: fn(),
  },
} satisfies Meta<typeof NotificationsMenu>

export default meta
type Story = StoryObj<typeof meta>

// The dropdown renders in a portal on <body>, outside the story's canvas, so it's found
// through `screen`.
export const Unread: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Notifications, 1 unread" }))

    const item = await screen.findByRole("link", { name: /Find a photo on Unsplash.*\(unread\)/ })
    await waitFor(() => expect(item).toBeVisible())
    await expect(item).toHaveAttribute("href", "/docs/unsplash-photos")
    // The thumbnail is decorative, so the link's name is still its title.
    await expect(item.querySelector("img")).toHaveAttribute(
      "src",
      "/docs-assets/media/unsplash-photos-hero.webp",
    )
    await expect(screen.getByText("October 18, 2026")).toBeVisible()
    await expect(screen.getByRole("link", { name: "All docs" })).toHaveAttribute("href", "/docs")

    await userEvent.click(item)
    await expect(args.onOpen).toHaveBeenCalledWith("docs:unsplash-photos")
    await userEvent.click(screen.getByRole("button", { name: "Mark all as read" }))
    await expect(args.onMarkAllRead).toHaveBeenCalledOnce()
  },
}

export const Settings: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Notifications, 1 unread" }))
    await userEvent.click(await screen.findByRole("button", { name: "Notification settings" }))

    const docs = await screen.findByRole("checkbox", { name: /Docs/ })
    await expect(docs).toBeChecked()
    await userEvent.click(docs)
    await expect(args.onMutedChange).toHaveBeenCalledWith(["docs"])
  },
}

export const Empty: Story = {
  args: { items: [], unread: [], muted: ["docs"], indexes: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Notifications" }))
    await waitFor(() => expect(screen.getByText("Nothing new.")).toBeVisible())
  },
}
