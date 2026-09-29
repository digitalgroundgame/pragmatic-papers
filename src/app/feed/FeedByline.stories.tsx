import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, waitFor, within } from "storybook/test"

import { authors } from "@/stories/fixtures/docs"
import { feedSummary } from "@/stories/fixtures/feed"

import { FeedByline } from "./FeedByline"

const meta = {
  title: "Feed/FeedByline",
  component: FeedByline,
  globals: { theme: "dark" },
  args: { article: feedSummary() },
  decorators: [
    (Story) => (
      <div className="w-[320px] bg-black p-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FeedByline>

export default meta
type Story = StoryObj<typeof meta>

/** Fits on one line, so it stays still. */
export const Short: Story = {
  args: { article: feedSummary({ title: "Zoning, briefly", heroImage: null }) },
  play: async ({ canvasElement }) => {
    const line = within(canvasElement).getByText("Zoning, briefly · Jordan Rivera")
    await expect(line).not.toHaveClass("feed-marquee")
  },
}

/** Too long for the row: the line scrolls back and forth instead of truncating. */
export const Marquee: Story = {
  args: { article: feedSummary({ authors }) },
  play: async ({ canvasElement }) => {
    const line = within(canvasElement).getByText(/Jordan Rivera, Sam Okafor, Priya Natarajan/)
    await waitFor(() => expect(line).toHaveClass("feed-marquee"))
  },
}

/** No hero image: the avatar falls back to the title's first letter. */
export const WithoutImage: Story = {
  args: { article: feedSummary({ heroImage: null }) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("T")).toBeInTheDocument()
  },
}
