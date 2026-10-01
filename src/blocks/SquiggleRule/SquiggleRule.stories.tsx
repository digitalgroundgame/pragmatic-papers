import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect } from "storybook/test"

import { SquiggleRuleBlock } from "./Component"

const meta = {
  title: "Blocks/SquiggleRule",
  component: SquiggleRuleBlock,
  args: { blockType: "squiggleRule", variant: "animated", size: "medium" },
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
