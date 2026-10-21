import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { DocDates } from "./DocDates"

const meta = {
  title: "Docs/DocDates",
  component: DocDates,
  args: { publishedAt: "2026-03-04T00:00:00.000Z" },
} satisfies Meta<typeof DocDates>

export default meta
type Story = StoryObj<typeof meta>

/** Published only: the day, spelled out in the tooltip. */
export const Published: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("March 4, 2026")).toHaveAttribute(
      "datetime",
      "2026-03-04",
    )
    await userEvent.hover(canvasElement.querySelector("#doc-dateline")!)
    await waitFor(() =>
      expect(document.querySelector("[data-slot=tooltip-content]")).toHaveTextContent(
        "PublishedWednesday, March 4, 2026",
      ),
    )
  },
}

/** Updated later: "Updated" and its day beside the published one, both in the tooltip. */
export const Updated: Story = {
  args: { revisedAt: "2026-10-09T00:00:00.000Z" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Updated Oct. 9, 2026")).toBeInTheDocument()
    await userEvent.hover(canvasElement.querySelector("#doc-dateline")!)
    await waitFor(() =>
      expect(document.querySelector("[data-slot=tooltip-content]")).toHaveTextContent(
        "UpdatedFriday, October 9, 2026",
      ),
    )
  },
}
