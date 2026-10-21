import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { CommentsUnpublished } from "./Unpublished"

const meta = {
  title: "Components/Comments/Unpublished",
  component: CommentsUnpublished,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-2xl p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CommentsUnpublished>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("heading", { name: "Comments" })).toBeInTheDocument()
    await expect(canvas.getByText(/open once this article is published/)).toBeInTheDocument()
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument()
  },
}
