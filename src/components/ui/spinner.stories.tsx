import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { Button } from "./button"
import { Spinner } from "./spinner"

const meta = {
  title: "UI/Spinner",
  component: Spinner,
} satisfies Meta<typeof Spinner>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const spinner = within(canvasElement).getByRole("status", { name: "Loading" })
    await expect(spinner).toHaveClass("animate-spin")
  },
}

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Spinner className="size-3" />
      <Spinner />
      <Spinner className="size-6" />
    </div>
  ),
}

export const InAButton: Story = {
  render: () => (
    <Button disabled>
      <Spinner aria-hidden />
      Saving…
    </Button>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("button", { name: "Saving…" })).toBeDisabled()
    await expect(canvas.queryByRole("status")).not.toBeInTheDocument()
  },
}
