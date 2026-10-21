import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, within } from "storybook/test"

import { docsTree } from "@/plugins/docs/sections"
import { docOrder, docParentId, docTreeParents } from "@/stories/fixtures/docsTree"

import { DocsLayout, DocsNav } from "."

const leaf = (
  n: number,
  slug: string,
  title: string,
  parent: string | null,
  navTitle?: string,
) => ({
  id: 100 + n,
  slug,
  title,
  navTitle,
  parent: parent ? docParentId(parent) : null,
  _order: docOrder(100 + n),
})

const tree = docsTree([
  // Left out of the tree: the sidebar links it as Home.
  leaf(0, "home", "Pragmatic Papers docs", null),
  ...docTreeParents,
  leaf(1, "notifications", "What's new: the bell", "getting-started"),
  leaf(2, "writing-and-publishing", "Writing and publishing", "getting-started"),
  leaf(3, "footnotes", "Footnotes", "articles"),
  leaf(4, "topics", "Tag articles with topics", "articles", "Topics"),
  leaf(5, "seo-tab", "The SEO tab", "articles"),
  leaf(6, "timeline-block", "The Timeline block", "blocks"),
  leaf(7, "media-collage", "The Media Collage block", "blocks"),
  leaf(8, "unsplash-photos", "Find photos on Unsplash", "media"),
  leaf(9, "volumes", "Put together a volume", "pages-and-volumes"),
  leaf(10, "comments", "Moderate comments", "moderation"),
  leaf(11, "experiments", "Switch beta features on", "site-settings"),
  // A doc at the top of the tree with nothing under it is a link of its own.
  leaf(12, "glossary", "Glossary", null),
])

const meta = {
  title: "Components/DocsNav",
  component: DocsNav,
  args: { tree },
} satisfies Meta<typeof DocsNav>

export default meta
type Story = StoryObj<typeof meta>

/** On a doc: its link is the current page. */
export const OnADoc: Story = {
  args: { current: "topics" },
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole("navigation", { name: "Docs" })
    const articles = within(nav).getByRole("list", { name: "Articles" })
    const topics = within(articles).getByRole("link", { name: "Topics" })
    await expect(topics).toHaveAttribute("aria-current", "page")
    await expect(topics).toHaveAttribute("href", "/docs/writing/articles/topics")
    // The section opens on its own page.
    await expect(within(articles).getByRole("link", { name: "Overview" })).toHaveAttribute(
      "href",
      "/docs/writing/articles",
    )
    await expect(within(nav).getByRole("link", { name: "What's new" })).not.toHaveAttribute(
      "aria-current",
    )
    // Its section's name reads as hovered; the others stay muted.
    await expect(within(nav).getByText("Articles")).toHaveClass("text-foreground")
    await expect(within(nav).getByText("Media")).toHaveClass("text-muted-foreground")
    // Only the open doc's section starts open; the others unfold on a click.
    await expect(within(nav).queryByRole("link", { name: "Footnotes" })).toBeVisible()
    await expect(
      within(nav).queryByRole("link", { name: "Find photos on Unsplash" }),
    ).not.toBeVisible()
    await userEvent.click(within(nav).getByText("Media"))
    await expect(within(nav).getByRole("link", { name: "Find photos on Unsplash" })).toBeVisible()
  },
}

/** On the docs' home: Home is the current page, and only Getting started is open. */
export const OnHome: Story = {
  args: { current: "home" },
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole("navigation", { name: "Docs" })
    await expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    await expect(within(nav).queryByRole("link", { name: "Pragmatic Papers docs" })).toBeNull()
    // Each area's name links to its page, over its sections.
    await expect(within(nav).getByRole("link", { name: "Writing" })).toHaveAttribute(
      "href",
      "/docs/writing",
    )
    await expect(within(nav).getByRole("link", { name: "Editing" })).toHaveAttribute(
      "href",
      "/docs/editing",
    )
    await expect(within(nav).getByRole("link", { name: "Glossary" })).toHaveAttribute(
      "href",
      "/docs/glossary",
    )
    await expect(within(nav).getByRole("link", { name: "Writing and publishing" })).toBeVisible()
    await expect(within(nav).queryByRole("link", { name: "Footnotes" })).not.toBeVisible()
  },
}

/** On What's new: its link is the current page. */
export const OnWhatsNew: Story = {
  args: { current: "/docs/whats-new" },
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole("navigation", { name: "Docs" })
    await expect(within(nav).getByRole("link", { name: "What's new" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    await expect(within(nav).getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    )
  },
}

/** The sidebar beside a doc, as a doc's page lays it out, with the breadcrumbs over the doc. */
export const Layout: Story = {
  args: { current: "topics" },
  parameters: { layout: "fullscreen" },
  render: (args) => (
    <DocsLayout
      {...args}
      breadcrumbs={[
        { name: "Docs", path: "/docs" },
        { name: "Writing", path: "/docs/writing" },
        { name: "Articles", path: "/docs/writing/articles" },
        { name: "Tag articles with topics", path: "/docs/writing/articles/topics" },
      ]}
    >
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
