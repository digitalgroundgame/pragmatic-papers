import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { Byline } from "@/components/Authors/Byline"
import { toBylineAuthor } from "@/components/Authors/BylineAuthor"
import { authors } from "@/stories/fixtures/docs"
import { landscapeImage, squareImage } from "@/stories/fixtures/media"

import { Tile, TileList } from "."

const meta = {
  title: "Components/Tile",
  component: Tile,
  args: {
    href: "/articles/the-case",
    title: "The Case for a Pragmatic Senate",
    image: landscapeImage,
    summary: "Why the chamber's rules matter more than its majorities, and what to change first.",
    byline: <Byline size="sm" authors={authors.slice(0, 2).map(toBylineAuthor)} />,
    badges: [
      { label: "Politics", href: "/topics/politics" },
      { label: "Ethics", href: "/topics/ethics" },
    ],
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Tile>

export default meta
type Story = StoryObj<typeof meta>

/** A list row: 4:3 thumbnail, every line clamped to one. */
export const Row: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("heading", { name: "The Case for a Pragmatic Senate" }),
    ).toBeVisible()
    await expect(canvas.getByRole("link", { name: "Politics" })).toHaveAttribute(
      "href",
      "/topics/politics",
    )
  },
}

/** No picture: the frame stays, with the P mark. */
export const WithoutImage: Story = { args: { image: null } }

/** A topic on /topics: the title a step up. */
export const LargeTitle: Story = {
  args: {
    title: "Philosophy",
    titleSize: "lg",
    byline: undefined,
    badges: undefined,
    meta: "17 articles",
  },
}

/** The aside's Most read: compact, square, ranked. */
export const CompactRanked: Story = {
  args: { density: "compact", ratio: "square", rank: 1, image: squareImage },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvasElement).toHaveTextContent("1")
    // Compact tiles leave out the summary, byline and badges.
    await expect(canvas.queryByRole("link", { name: "Politics" })).not.toBeInTheDocument()
  },
}

/** A grid: picture on top. */
export const StackedGrid: Story = {
  render: (args) => (
    <TileList columns={2}>
      <Tile {...args} layout="stacked" ratio="video" />
      <Tile {...args} layout="stacked" ratio="video" image={null} title="A second article" />
    </TileList>
  ),
}

/** Under a page's h1 with no section heading between (the Collection Grid block). */
export const AsH2: Story = {
  args: { as: "h2", layout: "stacked", ratio: "video" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("heading", { level: 2 })).toBeVisible()
  },
}
