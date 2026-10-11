import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { authors } from "@/stories/fixtures/docs"

import { Byline } from "./Byline"
import { toBylineAuthor } from "./BylineAuthor"

const meta = {
  title: "Components/Byline",
  component: Byline,
  args: { authors: authors.slice(0, 1).map(toBylineAuthor) },
} satisfies Meta<typeof Byline>

export default meta
type Story = StoryObj<typeof meta>

export const OneAuthor: Story = {}

export const TwoAuthors: Story = {
  args: { authors: authors.slice(0, 2).map(toBylineAuthor) },
}

export const ThreeAuthors: Story = {
  args: { authors: authors.map(toBylineAuthor) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Faces are decorative duplicates of the name links, kept out of the tab order.
    await expect(canvas.getAllByRole("link")).toHaveLength(3)
    await expect(canvasElement).toHaveTextContent("Jordan Rivera, Sam Okafor & Priya Natarajan")
  },
}
