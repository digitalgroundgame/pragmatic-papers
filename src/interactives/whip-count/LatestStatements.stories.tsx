import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, within } from "storybook/test"

import { whipCountData, whipCountWithStatements } from "@/stories/fixtures/whipCount"

import { LatestStatements } from "./LatestStatements"

const meta = {
  title: "Interactives/WhipCount/LatestStatements",
  component: LatestStatements,
  args: { data: whipCountWithStatements },
} satisfies Meta<typeof LatestStatements>

export default meta
type Story = StoryObj<typeof meta>

/** Earlier statements beside each member's latest, newest first; the rest wait behind a button. */
export const Default: Story = {}

/** The reader asks for every statement. */
export const ShowAll: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Show all 9 statements" }))
    await expect(canvas.getByText("Former Member")).toBeInTheDocument()
  },
}

/** Only each member's latest statement, as a count holds before any is replaced. */
export const LatestOnly: Story = { args: { data: whipCountData } }
