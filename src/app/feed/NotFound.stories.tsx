import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import FeedNotFound from "./not-found"

/** The feed's 404: the feed switched off, or a deep link to an unknown article. */
const meta = {
  title: "Feed/NotFound",
  component: FeedNotFound,
  globals: { theme: "dark" },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof FeedNotFound>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent("404")
    await expect(canvas.getByRole("link", { name: "Go home" })).toHaveAttribute("href", "/")
  },
}
