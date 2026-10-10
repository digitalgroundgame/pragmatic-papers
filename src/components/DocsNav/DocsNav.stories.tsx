import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, within } from "storybook/test"

import { groupDocsBySection } from "@/plugins/docs/sections"

import { DocsLayout, DocsNav } from "."

const sections = groupDocsBySection([
  { slug: "notifications", title: "What's new: the bell", section: "getting-started" },
  { slug: "writing-and-publishing", title: "Writing and publishing", section: "getting-started" },
  { slug: "footnotes", title: "Footnotes", section: "writing" },
  { slug: "topics", title: "Tag articles with topics", navTitle: "Topics", section: "writing" },
  { slug: "seo-tab", title: "The SEO tab", section: "writing" },
  { slug: "timeline-block", title: "The Timeline block", section: "blocks" },
  { slug: "media-collage", title: "The Media Collage block", section: "blocks" },
  { slug: "unsplash-photos", title: "Find photos on Unsplash", section: "media" },
  { slug: "experiments", title: "Switch beta features on", section: "site" },
])

const meta = {
  title: "Components/DocsNav",
  component: DocsNav,
  args: { sections },
} satisfies Meta<typeof DocsNav>

export default meta
type Story = StoryObj<typeof meta>

/** On a doc: its link is the current page. */
export const OnADoc: Story = {
  args: { current: "topics" },
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole("navigation", { name: "Docs" })
    const writing = within(nav).getByRole("list", { name: "Writing articles" })
    await expect(within(writing).getByRole("link", { name: "Topics" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    await expect(within(nav).getByRole("link", { name: "All docs" })).not.toHaveAttribute(
      "aria-current",
    )
    // Only the open doc's section starts open; the others unfold on a click.
    await expect(within(nav).queryByRole("link", { name: "Footnotes" })).toBeVisible()
    await expect(
      within(nav).queryByRole("link", { name: "Find photos on Unsplash" }),
    ).not.toBeVisible()
    await userEvent.click(within(nav).getByText("Photos and media"))
    await expect(within(nav).getByRole("link", { name: "Find photos on Unsplash" })).toBeVisible()
  },
}

/** On the /docs index: "All docs" is the current page. */
export const OnTheIndex: Story = {
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole("navigation", { name: "Docs" })
    await expect(within(nav).getByRole("link", { name: "All docs" })).toHaveAttribute(
      "aria-current",
      "page",
    )
  },
}

/** The sidebar beside a doc, as `/docs/<slug>` lays it out. */
export const Layout: Story = {
  args: { current: "topics" },
  parameters: { layout: "fullscreen" },
  render: (args) => (
    <DocsLayout {...args}>
      <article className="space-y-4 pt-2">
        <h1>Topics</h1>
        <p>
          Topics group articles by subject. Each topic has its own page listing every article tagged
          with it, newest first.
        </p>
      </article>
    </DocsLayout>
  ),
}
