import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, fn, userEvent, within } from "storybook/test"

import { Slider } from "./slider"

const meta = {
  title: "UI/Slider",
  component: Slider,
  args: { onValueChange: fn(), "aria-label": "Playback speed" },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Slider>

export default meta
type Story = StoryObj<typeof meta>

export const Single: Story = {
  args: { defaultValue: [40] },
  play: async ({ args, canvasElement }) => {
    const thumb = within(canvasElement).getByRole("slider", { name: "Playback speed" })
    await expect(thumb).toHaveAttribute("aria-valuenow", "40")
    thumb.focus()
    await userEvent.keyboard("{ArrowRight}")
    await expect(thumb).toHaveAttribute("aria-valuenow", "41")
    await expect(args.onValueChange).toHaveBeenCalled()
  },
}

export const Range: Story = {
  args: { defaultValue: [20, 80] },
}

export const Vertical: Story = {
  args: { defaultValue: [60], orientation: "vertical" },
}

export const Disabled: Story = {
  args: { defaultValue: [50], disabled: true },
}
