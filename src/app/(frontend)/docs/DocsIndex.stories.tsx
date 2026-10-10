import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { landscapeImage, squareImage, wideImage } from "@/stories/fixtures/media"

import { DocsIndex, type DocsIndexDoc } from "./DocsIndex"

const doc = (
  id: number,
  slug: string,
  title: string,
  section: string,
  publishedAt: string,
  summary: string,
  heroImage = landscapeImage,
) => ({ id, slug, title, section, publishedAt, summary, heroImage }) as DocsIndexDoc

// Newest first, as the query sorts them.
const docs = [
  doc(
    1,
    "notifications",
    "Find what's new in the bell",
    "getting-started",
    "2026-10-09",
    "The bell beside your avatar lists new help docs for your role.",
    wideImage,
  ),
  doc(
    2,
    "table-of-contents",
    "Add a table of contents to an article",
    "writing",
    "2026-09-29",
    "Turn on a contents list built from the article's headings.",
  ),
  doc(
    3,
    "media-references",
    "Why some media can't be deleted",
    "media",
    "2026-09-28",
    "Media used by published content stays until it's detached.",
    squareImage,
  ),
  doc(
    4,
    "timeline-block",
    "Show a sequence of events with the Timeline block",
    "blocks",
    "2026-04-25",
    "Dated entries down a line, with sources for each.",
  ),
  doc(
    5,
    "topics",
    "Tag articles with topics",
    "writing",
    "2026-03-09",
    "Topics group articles by subject, each with its own page.",
  ),
  doc(
    6,
    "volumes",
    "Put together a volume",
    "site",
    "2025-06-26",
    "Collect a week's articles under a numbered volume with an editor's note.",
    wideImage,
  ),
]

/** The /docs index (`DocsIndex`, which the page renders with every published doc). */
const meta = {
  title: "Pages/Docs",
  component: DocsIndex,
  parameters: { layout: "fullscreen" },
  args: { docs },
} satisfies Meta<typeof DocsIndex>

export default meta
type Story = StoryObj<typeof meta>

export const Index: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const latest = await canvas.findByRole("region", { name: "What's new" })
    await expect(within(latest).getAllByRole("listitem")).toHaveLength(3)
    const writing = canvas.getByRole("region", { name: "Writing articles" })
    await expect(
      within(writing).getByRole("link", { name: /Tag articles with topics/ }),
    ).toHaveAttribute("href", "/docs/topics")
  },
}

export const Dark: Story = {
  globals: { theme: "dark" },
}
