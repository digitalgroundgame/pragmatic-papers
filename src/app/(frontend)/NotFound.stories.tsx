import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import NotFound from "./not-found"

/** The site's 404. The feed has its own, dark only (Feed/NotFound). */
const meta = {
  title: "Layout/NotFound",
  component: NotFound,
} satisfies Meta<typeof NotFound>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent("404")
    await expect(canvas.getByRole("link", { name: "Go home" })).toHaveAttribute("href", "/")
  },
}

export const Dark: Story = {
  globals: { theme: "dark" },
}
