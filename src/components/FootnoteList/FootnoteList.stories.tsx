import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { knownContrastIssue } from "@/stories/a11y"

import { FootnoteList } from "."

const meta = {
  title: "Components/FootnoteList",
  component: FootnoteList,
  parameters: knownContrastIssue,
  args: {
    footnotes: [
      {
        index: 1,
        note: "Certified results, Jackson County Board of Election Commissioners.",
        attributionEnabled: true,
        link: { type: "custom", url: "https://example.com/results" },
      },
      {
        index: 2,
        note: "Turnout is ballots cast over registered voters on election day.",
        attributionEnabled: false,
      },
      {
        index: 3,
        note: "Interview with the county clerk, January 2026.",
        attributionEnabled: true,
        link: { type: "custom", url: "https://example.com/interview", newTab: true },
      },
    ],
  },
} satisfies Meta<typeof FootnoteList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const note = canvasElement.querySelector("#footnote-2")
    await expect(note).toHaveTextContent(/ballots cast over registered voters/)
    await expect(within(canvasElement).getAllByRole("link")).toHaveLength(2)
  },
}
