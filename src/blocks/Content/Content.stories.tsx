import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { articleBody, paragraphs } from "@/stories/fixtures/richText"

import { ContentBlock } from "./Component"

const meta = {
  title: "Blocks/Content",
  component: ContentBlock,
  parameters: { layout: "fullscreen" },
  args: {
    id: "content-story",
    blockType: "content",
    width: "narrow",
    columns: [{ id: "c1", size: "full", richText: articleBody }],
  },
  argTypes: {
    width: { control: "inline-radio", options: ["narrow", "wide", "full"] },
  },
} satisfies Meta<typeof ContentBlock>

export default meta
type Story = StoryObj<typeof meta>

export const SingleColumn: Story = {}

export const TwoColumns: Story = {
  args: {
    width: "wide",
    columns: [
      { id: "c1", size: "half", richText: paragraphs(2) },
      { id: "c2", size: "half", richText: paragraphs(3) },
    ],
  },
}

export const ThirdsSplit: Story = {
  args: {
    width: "full",
    columns: [
      { id: "c1", size: "oneThird", richText: paragraphs(2) },
      { id: "c2", size: "twoThirds", richText: articleBody },
    ],
  },
}
