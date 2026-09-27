import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, within } from "storybook/test"

import { Input } from "./input"

const meta = {
  title: "UI/Input",
  component: Input,
  args: { placeholder: "you@example.com", type: "email", "aria-label": "Email" },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox", { name: "Email" })
    await userEvent.type(input, "reader@pragmaticpapers.com")
    await expect(input).toHaveValue("reader@pragmaticpapers.com")
  },
}

export const Invalid: Story = {
  args: { "aria-invalid": true, defaultValue: "not-an-email" },
}

export const Disabled: Story = {
  args: { disabled: true },
}
