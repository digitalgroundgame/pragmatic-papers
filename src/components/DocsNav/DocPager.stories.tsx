import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { DocPager } from "./DocPager"

const home = { href: "/docs", title: "Pragmatic Papers docs", navTitle: "Home" }
const footnotes = {
  href: "/docs/writing/articles/footnotes",
  title: "Add footnotes as you type",
  navTitle: "Footnotes",
}
const topics = {
  href: "/docs/writing/articles/topics",
  title: "Tag articles with topics",
  navTitle: "Topics",
}

/** The previous and next docs at the foot of a doc, in the sidebar's order. */
const meta = {
  title: "Components/DocsNav/DocPager",
  component: DocPager,
  args: { previous: footnotes, next: topics },
} satisfies Meta<typeof DocPager>

export default meta
type Story = StoryObj<typeof meta>

export const Both: Story = {
  play: async ({ canvasElement }) => {
    const pager = within(canvasElement).getByRole("navigation", { name: "Previous and next docs" })
    await expect(within(pager).getByRole("link", { name: /Previous.*Footnotes/ })).toHaveAttribute(
      "href",
      "/docs/writing/articles/footnotes",
    )
    await expect(within(pager).getByRole("link", { name: /Next.*Topics/ })).toHaveAttribute(
      "href",
      "/docs/writing/articles/topics",
    )
  },
}

/** The first doc goes back to Home, at /docs. */
export const BackToHome: Story = {
  args: { previous: home },
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole("link", { name: /Previous.*Home/ })
    await expect(link).toHaveAttribute("href", "/docs")
  },
}

/** The last doc has only a Previous card. */
export const OnlyPrevious: Story = {
  args: { next: undefined },
}
