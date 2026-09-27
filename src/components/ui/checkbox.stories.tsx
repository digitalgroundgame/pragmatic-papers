import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, fn, userEvent, within } from "storybook/test"

import { Checkbox } from "./checkbox"
import { Label } from "./label"

const meta = {
  title: "UI/Checkbox",
  component: Checkbox,
  args: { onCheckedChange: fn() },
  render: (args) => (
    <Label>
      <Checkbox {...args} />
      Send me the weekly newsletter
    </Label>
  ),
} satisfies Meta<typeof Checkbox>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const checkbox = within(canvasElement).getByRole("checkbox", {
      name: "Send me the weekly newsletter",
    })
    await expect(checkbox).not.toBeChecked()
    await userEvent.click(checkbox)
    await expect(checkbox).toBeChecked()
    await expect(args.onCheckedChange).toHaveBeenCalledWith(true, expect.anything())
  },
}

export const Checked: Story = {
  args: { defaultChecked: true },
}

export const Invalid: Story = {
  args: { "aria-invalid": true },
}

export const Disabled: Story = {
  args: { disabled: true },
}
