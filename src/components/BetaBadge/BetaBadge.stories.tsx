import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, screen, userEvent, within } from "storybook/test"

import { isolatedDocs } from "@/stories/isolatedDocs"

import { BetaBadge } from "."

const meta = {
  title: "Components/BetaBadge",
  component: BetaBadge,
  parameters: isolatedDocs("240px"),
} satisfies Meta<typeof BetaBadge>

export default meta
type Story = StoryObj<typeof meta>

/** Beside each heading size a beta feature uses: the flask scales with the heading. */
export const InHeadings: Story = {
  render: () => (
    <div className="space-y-4 p-4 pt-12">
      <h1>
        Your account
        <BetaBadge info="Accounts are in beta: we're still trying them out, so they may change." />
      </h1>
      <h2>
        Comments <span className="text-muted-foreground">(3)</span>
        <BetaBadge info="Comments are in beta: we're still trying them out, so they may change." />
      </h2>
      <h2 className="text-lg font-semibold">
        Achievements
        <BetaBadge />
      </h2>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const heading = canvas.getByRole("heading", { name: "Your account" })
    await expect(within(heading).getByRole("button", { name: "Beta feature" })).toBeInTheDocument()
    await expect(canvas.getAllByRole("button", { name: "Beta feature" })).toHaveLength(3)
  },
}

/** Hovering the flask says what beta means for the feature. */
export const Hovered: Story = {
  args: { info: "Comments are in beta: we're still trying them out, so they may change." },
  render: (args) => (
    <h2 className="p-4 pt-12">
      Comments
      <BetaBadge {...args} />
    </h2>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.hover(within(canvasElement).getByRole("button", { name: "Beta feature" }))
    await expect(await screen.findByText(/Comments are in beta/)).toBeInTheDocument()
  },
}

/** Keyboards reach it too: tabbing to the flask opens the same tooltip. */
export const Focused: Story = {
  render: () => (
    <h2 className="p-4 pt-12">
      Achievements
      <BetaBadge />
    </h2>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.tab()
    await expect(within(canvasElement).getByRole("button", { name: "Beta feature" })).toHaveFocus()
    await expect(await screen.findByText(/still trying this out/)).toBeInTheDocument()
  },
}
