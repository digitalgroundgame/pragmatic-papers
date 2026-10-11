import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { FeedHTML } from "@/stories/FeedHTML"
import { timelineBlock } from "@/stories/fixtures/blocks"
import { storyFeedContext } from "@/stories/fixtures/feedContext"

import { TimelineBlock } from "./Component"
import { timelineToHTML } from "./converters"

const meta = {
  title: "Blocks/Timeline",
  component: TimelineBlock,
  args: timelineBlock,
} satisfies Meta<typeof TimelineBlock>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("heading", { level: 3, name: "How the district map changed" }),
    ).toBeInTheDocument()
    for (const title of [
      "Commission draws the first map",
      "Legislature adopts its own",
      "State court strikes it down",
      "A court-drawn map takes effect",
    ]) {
      await expect(canvas.getByText(title)).toBeInTheDocument()
    }
    // Two events carry an avatar; the others keep their place with an empty slot.
    await expect(canvas.getAllByRole("img", { name: "Portrait of a writer" })).toHaveLength(2)
    // Only the event with a citation turned on links out.
    await expect(canvas.getByRole("link")).toHaveAttribute("href", "https://example.com/bill")
  },
}

export const Untitled: Story = {
  args: { title: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole("heading")).not.toBeInTheDocument()
    await expect(canvas.getByText("Commission draws the first map")).toBeInTheDocument()
  },
}

/** A citation saved with its toggle off stays hidden, even with a link filled in. */
export const CitationTurnedOff: Story = {
  args: {
    title: null,
    events: [
      {
        date: "2022-02-17T12:00:00.000Z",
        title: "Legislature adopts its own",
        description: "Lawmakers pass a map splitting the county into four districts.",
        enableCitation: false,
        citation: { type: "custom", url: "https://example.com/bill", label: "[1]" },
      },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("link")).not.toBeInTheDocument()
  },
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
