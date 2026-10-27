import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { withPayloadAdminTheme } from "@/stories/payloadAdminTheme"

import { DocDiff } from "./DocDiff"

const meta = {
  title: "Admin/Docs/DocDiff",
  component: DocDiff,
  decorators: [withPayloadAdminTheme],
  args: {
    diff: [
      "@@ -2,4 +2,4 @@",
      " title: Ticker",
      "-summary: Hide a post from the Header global.",
      "+summary: Hide a post from the Ticker tab.",
      " publishedAt: 2026-10-11",
      " ---",
      "@@ -14,3 +14,4 @@",
      " ## Hiding a post",
      " ",
      "+Open **Site → Header → Ticker**, then press Hide beside the post.",
    ].join("\n"),
  },
} satisfies Meta<typeof DocDiff>

export default meta
type Story = StoryObj<typeof meta>

/** Two hunks: a changed summary, and a line added further down. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("Line 2")).toBeInTheDocument()
    await expect(canvas.getByText("Line 14")).toBeInTheDocument()
    await expect(canvas.getByText(/Hide a post from the Ticker tab\./)).toHaveClass(
      "doc-diff__line--added",
    )
    await expect(canvas.getByText(/Hide a post from the Header global\./)).toHaveClass(
      "doc-diff__line--removed",
    )
    await expect(canvas.getAllByText("Added:")).toHaveLength(2)
  },
}

/** A change that only touched the pictures or the note. */
export const NoTextChanges: Story = {
  args: { diff: "" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("The doc’s text didn’t change.")).toBeVisible()
  },
}
