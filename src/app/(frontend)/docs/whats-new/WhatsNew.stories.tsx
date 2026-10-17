import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { docSectionId, docSectionNodes } from "@/stories/fixtures/docSections"
import { landscapeImage, squareImage, wideImage } from "@/stories/fixtures/media"

import { WhatsNew, type WhatsNewDoc, type WhatsNewSection } from "./WhatsNew"

const doc = (
  id: number,
  slug: string,
  title: string,
  section: string,
  publishedAt: string,
  summary: string,
  heroImage = landscapeImage,
) =>
  ({
    id,
    slug,
    title,
    section: docSectionId(section),
    publishedAt,
    summary,
    heroImage,
  }) as WhatsNewDoc

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
    "articles",
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
    "articles",
    "2026-03-09",
    "Topics group articles by subject, each with its own page.",
  ),
  doc(
    6,
    "volumes",
    "Put together a volume",
    "pages-and-volumes",
    "2025-06-26",
    "Collect a week's articles under a numbered volume with an editor's note.",
    wideImage,
  ),
]

/** /docs/whats-new (`WhatsNew`, which the page renders with every published doc). */
const meta = {
  title: "Pages/Docs/What's new",
  component: WhatsNew,
  parameters: { layout: "fullscreen" },
  args: { docs, sections: docSectionNodes as WhatsNewSection[] },
} satisfies Meta<typeof WhatsNew>

export default meta
type Story = StoryObj<typeof meta>

export const Index: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const latest = await canvas.findByRole("region", { name: "What's new" })
    await expect(
      within(latest).getByRole("link", { name: /Tag articles with topics/ }),
    ).toHaveAttribute("href", "/docs/topics")
  },
}

export const Dark: Story = {
  globals: { theme: "dark" },
}
