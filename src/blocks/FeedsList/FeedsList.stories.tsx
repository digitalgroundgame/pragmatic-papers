import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { FeedsListBlock } from "./Component"

const meta = {
  title: "Blocks/FeedsList",
  component: FeedsListBlock,
  parameters: { layout: "fullscreen" },
  args: {
    blockType: "feedsList",
    list: "feeds",
    title: "RSS feeds",
    description:
      "Paste a feed's address into your feed reader to get new pieces as they're published.",
  },
} satisfies Meta<typeof FeedsListBlock>

export default meta
type Story = StoryObj<typeof meta>

export const Feeds: Story = {
  play: async ({ canvasElement }) => {
    const section = within(within(canvasElement).getByRole("region", { name: "RSS feeds" }))
    await expect(section.getByRole("link", { name: "Articles" })).toHaveAttribute(
      "href",
      "/articles/feed.xml",
    )
    await expect(section.getByText(/Substack's importer/)).toBeInTheDocument()
  },
}

export const Sitemaps: Story = {
  args: {
    list: "sitemaps",
    title: "Sitemaps",
    description: "For search engines: the sitemap index lists all the others.",
  },
  play: async ({ canvasElement }) => {
    const section = within(within(canvasElement).getByRole("region", { name: "Sitemaps" }))
    await expect(section.getByRole("link", { name: "Sitemap index" })).toHaveAttribute(
      "href",
      "/sitemap_index.xml",
    )
  },
}

/** Without a heading or introduction: just the links, for a page that introduces them itself. */
export const LinksOnly: Story = {
  args: { title: null, description: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole("heading")).not.toBeInTheDocument()
    await expect(canvas.getByRole("link", { name: "Volumes" })).toBeInTheDocument()
  },
}
