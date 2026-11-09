import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { ReadOnSubstack } from "."

const meta = {
  title: "Components/ReadOnSubstack",
  component: ReadOnSubstack,
  args: {
    article: {
      syndicateToSubstack: true,
      substackUrl: "https://thepragmaticpapers.substack.com/p/the-case-for-ranked-choice",
    },
  },
} satisfies Meta<typeof ReadOnSubstack>

export default meta
type Story = StoryObj<typeof meta>

/** Shown under an article once an editor has pasted its Substack post's address. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole("link", { name: "Read on Substack" })
    await expect(link).toHaveAttribute(
      "href",
      "https://thepragmaticpapers.substack.com/p/the-case-for-ranked-choice",
    )
    await expect(link).toHaveAttribute("target", "_blank")
    await expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"))
  },
}

/** An article that isn't on Substack yet shows nothing. */
export const NotImported: Story = {
  args: { article: { syndicateToSubstack: true, substackUrl: null } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("link")).not.toBeInTheDocument()
  },
}
