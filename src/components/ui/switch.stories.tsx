import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, fn, userEvent, waitFor, within } from "storybook/test"

import { Label } from "./label"
import { Switch } from "./switch"

const meta = {
  title: "UI/Switch",
  component: Switch,
  args: { onCheckedChange: fn() },
  render: (args) => (
    <Label>
      <Switch {...args} />
      Show the ticker
    </Label>
  ),
} satisfies Meta<typeof Switch>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const toggle = within(canvasElement).getByRole("switch", { name: "Show the ticker" })
    await expect(toggle).not.toBeChecked()
    await userEvent.click(toggle)
    await expect(toggle).toBeChecked()
    await expect(args.onCheckedChange).toHaveBeenCalledWith(true, expect.anything())
  },
}

export const Checked: Story = {
  args: { defaultChecked: true },
  play: async ({ canvasElement }) => {
    const toggle = within(canvasElement).getByRole("switch", { name: "Show the ticker" })
    await expect(toggle).toBeChecked()
    // The knob stays inside the track.
    const thumb = toggle.querySelector<HTMLElement>('[data-slot="switch-thumb"]')!
    await waitFor(() => {
      expect(thumb.getBoundingClientRect().right).toBeLessThanOrEqual(
        toggle.getBoundingClientRect().right,
      )
    })
  },
}

export const Small: Story = {
  args: { size: "sm" },
}

export const Disabled: Story = {
  args: { disabled: true },
}
