import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { knownContrastIssue } from "@/stories/a11y"
import { FeedHTML } from "@/stories/FeedHTML"
import { timelineBlock } from "@/stories/fixtures/blocks"
import { storyFeedContext } from "@/stories/fixtures/feedContext"

import { TimelineBlock } from "./Component"
import { timelineToHTML } from "./converters"

const meta = {
  title: "Blocks/Timeline",
  component: TimelineBlock,
  parameters: knownContrastIssue,
  args: timelineBlock,
} satisfies Meta<typeof TimelineBlock>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Untitled: Story = {
  args: { title: null },
}

/** The timeline in the feeds: a heading and a list of dated events linking to their sources. */
export const Feed: Story = {
  render: (args) => <FeedHTML html={timelineToHTML(args, storyFeedContext())} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole("listitem")).toHaveLength(4)
    // Formatted the same way as on the page.
    await expect(canvas.getByText("November 4, 2021")).toBeInTheDocument()
    await expect(canvas.getByRole("link", { name: "[source]" })).toHaveAttribute(
      "href",
      "https://example.com/bill",
    )
  },
}
