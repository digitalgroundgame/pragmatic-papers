import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, within } from "storybook/test"

import { groupDocs } from "@/plugins/docs/sections"
import { docSectionId, docSectionNodes } from "@/stories/fixtures/docSections"

import { DocsLayout, DocsNav } from "."

const areas = groupDocs(
  [
    // Left out of the sections: the sidebar links it as Home.
    { slug: "home", title: "Pragmatic Papers docs", section: null },
    {
      slug: "notifications",
      title: "What's new: the bell",
      section: docSectionId("getting-started"),
    },
    {
      slug: "writing-and-publishing",
      title: "Writing and publishing",
      section: docSectionId("getting-started"),
    },
    { slug: "footnotes", title: "Footnotes", section: docSectionId("articles") },
    {
      slug: "topics",
      title: "Tag articles with topics",
      navTitle: "Topics",
      section: docSectionId("articles"),
    },
    { slug: "seo-tab", title: "The SEO tab", section: docSectionId("articles") },
    { slug: "timeline-block", title: "The Timeline block", section: docSectionId("blocks") },
    { slug: "media-collage", title: "The Media Collage block", section: docSectionId("blocks") },
    { slug: "unsplash-photos", title: "Find photos on Unsplash", section: docSectionId("media") },
    { slug: "volumes", title: "Put together a volume", section: docSectionId("pages-and-volumes") },
    {
      slug: "experiments",
      title: "Switch beta features on",
      section: docSectionId("site-settings"),
    },
  ],
  docSectionNodes,
)

const meta = {
  title: "Components/DocsNav",
  component: DocsNav,
  args: { areas },
} satisfies Meta<typeof DocsNav>

export default meta
type Story = StoryObj<typeof meta>

/** On a doc: its link is the current page. */
export const OnADoc: Story = {
  args: { current: "topics" },
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole("navigation", { name: "Docs" })
    const writing = within(nav).getByRole("list", { name: "Articles" })
    await expect(within(writing).getByRole("link", { name: "Topics" })).toHaveAttribute(
      "aria-current",
      "page",
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
    // Sections sit under their area; one with no docs yet isn't shown.
    await expect(within(nav).getByText("Writing")).toBeVisible()
    await expect(within(nav).getByText("Editing")).toBeVisible()
    await expect(within(nav).queryByText("Reading")).toBeNull()
    await expect(within(nav).queryByText("Development")).toBeNull()
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

/** The sidebar beside a doc, as `/docs/<slug>` lays it out, with the breadcrumbs over the doc. */
export const Layout: Story = {
  args: { current: "topics" },
  parameters: { layout: "fullscreen" },
  render: (args) => (
    <DocsLayout
      {...args}
      breadcrumbs={[
        { name: "Docs", path: "/docs" },
        { name: "Tag articles with topics", path: "/docs/topics" },
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
