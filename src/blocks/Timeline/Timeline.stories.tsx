import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { knownContrastIssue } from "@/stories/a11y"
import { squareImage } from "@/stories/fixtures/media"

import { TimelineBlock } from "./Component"

const meta = {
  title: "Blocks/Timeline",
  component: TimelineBlock,
  parameters: knownContrastIssue,
  args: {
    blockType: "timeline",
    title: "How the district map changed",
    events: [
      {
        date: "2021-11-04T12:00:00.000Z",
        title: "Commission draws the first map",
        description: "The bipartisan commission deadlocks and sends two maps to the legislature.",
        avatar: squareImage,
      },
      {
        date: "2022-02-17T12:00:00.000Z",
        title: "Legislature adopts its own",
        description: "Lawmakers pass a map splitting the county into four districts.",
        enableCitation: true,
        citation: { type: "custom", url: "https://example.com/bill", label: "[1]" },
      },
      {
        date: "2022-06-30T12:00:00.000Z",
        title: "State court strikes it down",
        description:
          "The court rules the split violates the state constitution's compactness rule.",
        avatar: squareImage,
      },
      {
        date: "2023-01-09T12:00:00.000Z",
        title: "A court-drawn map takes effect",
        description: "The special master's map is used for the 2024 elections.",
      },
    ],
  },
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
