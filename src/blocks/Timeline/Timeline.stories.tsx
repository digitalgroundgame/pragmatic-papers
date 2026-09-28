import type { Meta, StoryObj } from "@storybook/nextjs-vite"

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

export const Default: Story = {}

export const Untitled: Story = {
  args: { title: null },
}
