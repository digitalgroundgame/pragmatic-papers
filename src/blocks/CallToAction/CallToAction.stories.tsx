import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { createHeadingNode, createParagraph, richText } from "@/stories/fixtures/richText"

import { CallToActionBlock } from "./Component"

const meta = {
  title: "Blocks/CallToAction",
  component: CallToActionBlock,
  args: {
    id: "cta-story",
    blockType: "cta",
    richText: richText(
      createHeadingNode("Get every volume in your inbox", "h3"),
      createParagraph("One email a week. No ads, no tracking, unsubscribe any time."),
    ),
    links: [
      {
        link: { type: "custom", url: "/newsletter", label: "Subscribe" },
      },
    ],
  },
} satisfies Meta<typeof CallToActionBlock>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole("link", { name: "Subscribe" })
    await expect(link).toHaveAttribute("href", "/newsletter")
  },
}

export const TwoLinks: Story = {
  args: {
    links: [
      { link: { type: "custom", url: "/newsletter", label: "Subscribe" } },
      { link: { type: "custom", url: "/volumes", label: "Browse volumes" } },
    ],
  },
}
