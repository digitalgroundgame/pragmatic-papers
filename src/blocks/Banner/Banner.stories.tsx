import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

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

/** The banner carries the editor's text, bold run included, tinted for its style. */
const expectBanner =
  (tint: string): Story["play"] =>
  async ({ canvasElement }) => {
    const bold = await within(canvasElement).findByText("Correction:", { exact: false })
    await expect(bold.tagName).toBe("STRONG")
    const banner = canvasElement.querySelector(".payload-richtext")
    await expect(banner).toHaveTextContent("misstated the turnout in 2022")
    await expect(banner).toHaveClass(tint)
  }

export const Info: Story = {
  play: expectBanner("bg-card"),
}

export const Warning: Story = {
  args: { style: "warning" },
  play: expectBanner("border-warning"),
}

export const Error: Story = {
  args: { style: "error" },
  play: expectBanner("border-error"),
}

export const Success: Story = {
  args: { style: "success" },
  play: expectBanner("border-success"),
}
