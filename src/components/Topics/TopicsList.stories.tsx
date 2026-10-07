import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { topics } from "@/stories/fixtures/docs"

import { TopicsList } from "./TopicsList"

const meta = {
  title: "Components/TopicsList",
  component: TopicsList,
  args: { topics },
} satisfies Meta<typeof TopicsList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const section = within(canvasElement).getByRole("region", { name: "Topics" })
    await expect(within(section).getByRole("link", { name: "Courts" })).toHaveAttribute(
      "href",
      "/topics/courts",
    )
  },
}

export const Unresolved: Story = {
  args: { topics: [1, 2] },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("section")).not.toBeInTheDocument()
  },
}
