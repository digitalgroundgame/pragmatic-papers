import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, screen, userEvent, waitFor, within } from "storybook/test"

import { withBetaFeatures } from "@/stories/fixtures/betaFeatures"
import { isolatedDocs } from "@/stories/isolatedDocs"

import { BetaBadge } from "."

/** The open tooltip (the same note also sits in the button's hidden description). */
const tooltip = (text: RegExp) =>
  screen.findByText(text, { selector: '[data-slot="tooltip-content"]' })
const queryTooltip = (text: RegExp) =>
  screen.queryByText(text, { selector: '[data-slot="tooltip-content"]' })

const meta = {
  title: "Components/BetaBadge",
  component: BetaBadge,
  args: { feature: "comments" },
  parameters: isolatedDocs("240px"),
  decorators: [withBetaFeatures()],
} satisfies Meta<typeof BetaBadge>

export default meta
type Story = StoryObj<typeof meta>

/** Beside each heading size a beta feature uses: the flask scales with the heading. */
export const InHeadings: Story = {
  render: () => (
    <div className="space-y-4 p-4 pt-12">
      <h1>
        Your account
        <BetaBadge feature="sso" />
      </h1>
      <h2>
        Comments <span className="text-muted-foreground">(3)</span>
        <BetaBadge feature="comments" />
      </h2>
      <h2 className="text-lg font-semibold">
        Achievements
        <BetaBadge feature="achievements" />
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

/** Once a feature graduates (its `beta` note is deleted), the flask renders nothing. */
export const Graduated: Story = {
  decorators: [withBetaFeatures({})],
  render: (args) => (
    <h2 className="p-4">
      Comments
      <BetaBadge {...args} />
    </h2>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).queryByRole("button", { name: "Beta feature" }),
    ).not.toBeInTheDocument()
  },
}

/** Hovering the flask says what beta means for the feature. */
export const Hovered: Story = {
  render: (args) => (
    <h2 className="p-4 pt-12">
      Comments
      <BetaBadge {...args} />
    </h2>
  ),
  play: async ({ canvasElement }) => {
    const flask = within(canvasElement).getByRole("button", { name: "Beta feature" })
    // Screen readers hear what beta means without opening the tooltip.
    await expect(flask).toHaveAccessibleDescription(
      "Comments are in beta: we're still trying them out, so they may change.",
    )
    await userEvent.hover(flask)
    await expect(await tooltip(/Comments are in beta/)).toBeInTheDocument()
  },
}

/** Keyboards reach it too: tabbing to the flask opens the same tooltip. */
export const Focused: Story = {
  args: { feature: "achievements" },
  render: (args) => (
    <h2 className="p-4 pt-12">
      Achievements
      <BetaBadge {...args} />
    </h2>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.tab()
    await expect(within(canvasElement).getByRole("button", { name: "Beta feature" })).toHaveFocus()
    await expect(await tooltip(/Achievements are in beta/)).toBeInTheDocument()
  },
}

/** Touch screens have no hover: a tap opens the tooltip, and a tap anywhere else closes it. */
export const Tapped: Story = {
  render: (args) => (
    <h2 className="p-4 pt-12">
      Comments
      <BetaBadge {...args} />
    </h2>
  ),
  play: async ({ canvasElement }) => {
    const flask = within(canvasElement).getByRole("button", { name: "Beta feature" })
    await userEvent.pointer({ keys: "[TouchA]", target: flask })
    await expect(await tooltip(/Comments are in beta/)).toBeInTheDocument()
    await userEvent.pointer({ keys: "[TouchA]", target: canvasElement })
    await waitFor(() => expect(queryTooltip(/Comments are in beta/)).not.toBeInTheDocument())
  },
}
