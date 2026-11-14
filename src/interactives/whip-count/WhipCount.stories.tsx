import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, within } from "storybook/test"

import { whipCountData } from "@/stories/fixtures/whipCount"

import { WhipCount } from "./WhipCount"

const meta = {
  title: "Interactives/WhipCount",
  component: WhipCount,
  args: { title: "Who will lead the caucus?", data: whipCountData, storageKey: "storybook" },
  beforeEach: () => {
    window.localStorage.removeItem("whip-count-draft:storybook")
  },
} satisfies Meta<typeof WhipCount>

export default meta
type Story = StoryObj<typeof meta>

/** The public count; the reader's own count waits behind a button. */
export const Default: Story = {}

/** A reader gives the uncommitted Progressives to the first candidate, who then has a majority. */
export const BlocAssigned: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Make your own count" }))
    await userEvent.click(canvas.getByRole("button", { name: "Give Progressive to Hale" }))
    await expect(canvas.getByText("Marion Hale wins in your count.")).toBeInTheDocument()
  },
}

/** Counting the outgoing member raises the number of voters and the majority. */
export const OutgoingCounted: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByLabelText("Count outgoing senators as voters"))
    await expect(canvas.getByText(/10 vote, so 6 wins/)).toBeInTheDocument()
  },
}
