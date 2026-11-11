import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { isolatedDocs } from "@/stories/isolatedDocs"

import { BetaBadge } from "."

const meta = {
  title: "Components/BetaBadge",
  component: BetaBadge,
  parameters: isolatedDocs("200px"),
} satisfies Meta<typeof BetaBadge>

export default meta
type Story = StoryObj<typeof meta>

/** Beside each heading size a beta feature uses, in the body face whatever the heading's. */
export const InHeadings: Story = {
  render: () => (
    <div className="space-y-4 p-4">
      <h1>
        Your account
        <BetaBadge />
      </h1>
      <h2>
        Comments <span className="text-muted-foreground">(3)</span>
        <BetaBadge />
      </h2>
      <h2 className="text-lg font-semibold">
        Achievements
        <BetaBadge />
      </h2>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("heading", { name: "Your account Beta" })).toBeInTheDocument()
    await expect(canvas.getAllByText("Beta")).toHaveLength(3)
  },
}
