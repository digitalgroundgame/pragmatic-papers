import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, fn, userEvent, within } from "storybook/test"

import { withPayloadAdminTheme } from "@/stories/payloadAdminTheme"

import { ExperimentSwitch } from "./ExperimentSwitch"

const meta = {
  title: "Admin/SiteSettings/ExperimentSwitch",
  component: ExperimentSwitch,
  decorators: [withPayloadAdminTheme],
  args: {
    id: "field-experiments__ticker",
    label: "Ticker",
    description:
      "The strip under the header on every page: a broadcast when one of our YouTube channels is live, and our latest posts from Bluesky and X.",
    checked: false,
    onCheckedChange: fn(),
  },
} satisfies Meta<typeof ExperimentSwitch>

export default meta
type Story = StoryObj<typeof meta>

export const Off: Story = {
  play: async ({ args, canvasElement }) => {
    const toggle = within(canvasElement).getByRole("switch", { name: "Ticker" })
    await expect(toggle).not.toBeChecked()
    await expect(toggle).toHaveAccessibleDescription(expect.stringContaining("YouTube"))
    await userEvent.click(toggle)
    await expect(args.onCheckedChange).toHaveBeenCalledWith(true)
  },
}

export const On: Story = {
  args: { checked: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("switch", { name: "Ticker" })).toBeChecked()
  },
}

export const ReadOnly: Story = {
  args: { checked: true, disabled: true },
}
