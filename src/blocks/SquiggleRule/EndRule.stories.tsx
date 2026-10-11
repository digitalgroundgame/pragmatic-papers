import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect } from "storybook/test"

import { squiggleRuleBlock } from "@/stories/fixtures/blocks"

import { EndRule } from "./EndRule"

const paragraph = {
  type: "paragraph",
  version: 1,
  children: [{ type: "text", text: "The last line of the piece.", version: 1 }],
}
const content = (...children: unknown[]) =>
  ({ root: { type: "root", version: 1, children } }) as never

const meta = {
  title: "Blocks/SquiggleRule/EndRule",
  component: EndRule,
  args: { content: content(paragraph) },
} satisfies Meta<typeof EndRule>

export default meta
type Story = StoryObj<typeof meta>

/** Closes the piece with a small animated squiggle. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const rule = canvasElement.querySelector(".max-w-xs")
    await expect(rule).toBeInTheDocument()
    await expect(getComputedStyle(rule!.firstElementChild!).backgroundImage).toContain(
      "/squiggle.svg",
    )
  },
}

/** A piece that already ends with a Squiggle Rule block gets no second one. */
export const AlreadyEndsWithOne: Story = {
  args: {
    content: content(paragraph, { type: "block", version: 2, fields: squiggleRuleBlock }),
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[class*='max-w-']")).not.toBeInTheDocument()
  },
}
