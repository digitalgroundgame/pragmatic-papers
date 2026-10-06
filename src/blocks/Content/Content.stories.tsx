import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

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

/** The columns the block drew, in order: one rich-text wrapper each. */
const columnsIn = (canvasElement: HTMLElement): Element[] =>
  Array.from(canvasElement.querySelectorAll("section > .payload-richtext"))

export const SingleColumn: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("heading", { level: 2, name: "Why the small races matter" }),
    ).toBeInTheDocument()
    await expect(canvas.getByRole("link", { name: "full turnout report" })).toHaveAttribute(
      "href",
      "https://example.com/report",
    )
    await expect(columnsIn(canvasElement)).toHaveLength(1)
    await expect(canvasElement.querySelector("section")).toHaveClass("max-w-3xl")
  },
}

export const TwoColumns: Story = {
  args: {
    width: "wide",
    columns: [
      { id: "c1", size: "half", richText: paragraphs(2) },
      { id: "c2", size: "half", richText: paragraphs(3) },
    ],
  },
  play: async ({ canvasElement }) => {
    const columns = columnsIn(canvasElement)
    await expect(columns).toHaveLength(2)
    for (const column of columns) await expect(column).toHaveClass("lg:col-span-6")
    await expect(within(columns[1] as HTMLElement).getAllByRole("paragraph")).toHaveLength(3)
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
  play: async ({ canvasElement }) => {
    const [narrow, wide] = columnsIn(canvasElement)
    await expect(narrow).toHaveClass("lg:col-span-4")
    await expect(wide).toHaveClass("lg:col-span-8")
  },
}

/** A content block saved with no columns draws nothing, not an empty grid. */
export const NoColumns: Story = {
  args: { columns: [] },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("section")).not.toBeInTheDocument()
  },
}
