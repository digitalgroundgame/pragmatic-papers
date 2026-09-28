import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, within } from "storybook/test"

import { Textarea } from "./textarea"

const meta = {
  title: "UI/Textarea",
  component: Textarea,
  args: { placeholder: "Tell us what you think", "aria-label": "Message" },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Textarea>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const textarea = within(canvasElement).getByRole("textbox", { name: "Message" })
    await userEvent.type(textarea, "Great piece.")
    await expect(textarea).toHaveValue("Great piece.")
  },
}

export const Invalid: Story = {
  args: { "aria-invalid": true },
}

export const Disabled: Story = {
  args: { disabled: true, defaultValue: "Submissions are closed." },
}
