import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import type { CollectionGridSlots } from "@/payload-types"
import { knownContrastIssue } from "@/stories/a11y"
import { articles, volumes } from "@/stories/fixtures/docs"

import { CollectionGridBlock } from "./Component"
import { type Layout, slotCounts } from "./helpers/layouts"

function slotsFor(layout: Layout): CollectionGridSlots {
  const [, max] = slotCounts[layout]!
  return articles.slice(0, max).map((article, i) => ({
    id: `slot-${i}`,
    collection: { relationTo: "articles", value: article },
    showByline: true,
  }))
}

function layoutStory(layout: Layout): Story {
  return { args: { layout, slots: slotsFor(layout) } }
}

const meta = {
  title: "Blocks/CollectionGrid",
  component: CollectionGridBlock,
  parameters: { layout: "fullscreen" },
  args: { blockType: "collectionGrid", layout: "euler-3", slots: slotsFor("euler-3") },
  decorators: [
    (Story) => (
      <div className="py-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CollectionGridBlock>

export default meta
type Story = StoryObj<typeof meta>

export const BernoulliLeft = layoutStory("bernoulli-left")
export const BernoulliRight = layoutStory("bernoulli-right")
export const Euler2 = layoutStory("euler-2")
export const Euler3: Story = {
  ...layoutStory("euler-3"),
  play: async ({ canvasElement }) => {
    const links = await within(canvasElement).findAllByRole("link")
    await expect(links).toHaveLength(3)
    await expect(links[0]).toHaveAttribute("href", "/articles/article-1")
  },
}
export const Newton4 = layoutStory("newton-4")
export const Euler5 = layoutStory("euler-5")
export const Fibonacci6 = layoutStory("fibonacci-6")
export const Vespucci7 = layoutStory("vespucci-7")
export const Fibonacci7 = layoutStory("fibonacci-7")
export const Gauss10 = layoutStory("gauss-10")

/** Gauss 10's bottom-center and bottom-right slots are optional; the bottom-left tile takes the row. */
export const Gauss10WithoutOptionalSlots: Story = {
  args: { layout: "gauss-10", slots: slotsFor("gauss-10").slice(0, 8) },
  play: async ({ canvasElement }) => {
    const links = await within(canvasElement).findAllByRole("link")
    await expect(links).toHaveLength(8)
    await expect(links.map((link) => link.getAttribute("href"))).toContain("/articles/article-8")
  },
}

export const KickersAndOverrides: Story = {
  parameters: knownContrastIssue,
  args: {
    layout: "euler-3",
    slots: [
      {
        id: "k1",
        collection: { relationTo: "articles", value: articles[0]! },
        kicker: "Analysis",
        showByline: true,
      },
      {
        id: "k2",
        collection: { relationTo: "articles", value: articles[1]! },
        kicker: "Opinion",
        overrideTitle: "A shorter headline chosen for the front page",
      },
      {
        id: "k3",
        collection: { relationTo: "volumes", value: volumes[0]! },
        kicker: "This week",
      },
    ],
  },
}
