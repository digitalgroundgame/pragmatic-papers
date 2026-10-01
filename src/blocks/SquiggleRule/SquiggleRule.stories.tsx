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

/** Which squiggle the rule draws, read off the image it paints, and how wide it runs. */
const expectRule =
  (image: string, width: string): Story["play"] =>
  async ({ canvasElement }) => {
    const rule = canvasElement.querySelector(`.${width}`)
    await expect(rule).toBeInTheDocument()
    const line = rule!.firstElementChild!
    await expect(getComputedStyle(line).backgroundImage).toContain(`/${image}`)
  }

export const Animated: Story = {
  play: expectRule("squiggle.svg", "max-w-md"),
}

export const Static: Story = {
  args: { variant: "static" },
  play: expectRule("squiggle-static.svg", "max-w-md"),
}

/** A rule saved before sizes existed has none, and falls back to medium. */
export const WithoutSize: Story = {
  args: { size: null },
  play: expectRule("squiggle.svg", "max-w-md"),
}

export const Full: Story = {
  args: { size: "full" },
  play: expectRule("squiggle.svg", "w-full"),
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
