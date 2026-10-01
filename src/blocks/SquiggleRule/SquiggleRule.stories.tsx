import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect } from "storybook/test"

import { FeedHTML } from "@/stories/FeedHTML"
import { squiggleRuleBlock } from "@/stories/fixtures/blocks"

import { SquiggleRuleBlock } from "./Component"
import { squiggleRuleToHTML } from "./converters"

const meta = {
  title: "Blocks/SquiggleRule",
  component: SquiggleRuleBlock,
  args: squiggleRuleBlock,
  argTypes: {
    variant: { control: "inline-radio", options: ["animated", "static"] },
    size: { control: "inline-radio", options: ["small", "medium", "large", "full"] },
  },
} satisfies Meta<typeof SquiggleRuleBlock>

export default meta
type Story = StoryObj<typeof meta>

export const Animated: Story = {}

export const Static: Story = {
  args: { variant: "static" },
}

/** The rule in the feeds: a plain thematic break between paragraphs. */
export const Feed: Story = {
  render: () => (
    <FeedHTML html={`<p>Before the break.</p>${squiggleRuleToHTML()}<p>After the break.</p>`} />
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("hr")).toBeInTheDocument()
  },
}
