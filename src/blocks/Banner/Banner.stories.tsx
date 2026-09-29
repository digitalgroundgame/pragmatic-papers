import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { createParagraph, createTextNode, richText, TextFormat } from "@/stories/fixtures/richText"

import { BannerBlock } from "./Component"

const meta = {
  title: "Blocks/Banner",
  component: BannerBlock,
  args: {
    blockType: "banner",
    style: "info",
    content: richText(
      createParagraph([
        createTextNode("Correction: ", TextFormat.Bold),
        createTextNode("an earlier version of this article misstated the turnout in 2022."),
      ]),
    ),
  },
  argTypes: {
    style: { control: "inline-radio", options: ["info", "warning", "error", "success"] },
  },
} satisfies Meta<typeof BannerBlock>

export default meta
type Story = StoryObj<typeof meta>

export const Info: Story = {}

export const Warning: Story = {
  args: { style: "warning" },
}

export const Error: Story = {
  args: { style: "error" },
}

export const Success: Story = {
  args: { style: "success" },
}
