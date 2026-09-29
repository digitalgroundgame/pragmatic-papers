import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { articles } from "@/stories/fixtures/docs"
import { feedArticle } from "@/stories/fixtures/feed"

import { FEED_AD_INTERVAL } from "./ads/registry"
import { FeedShell } from "./FeedShell"
import { renderFeedArticle } from "./renderFeedArticle"

// One more article than the ad interval, so an ad sits between the fifth and sixth.
const items = articles.slice(0, FEED_AD_INTERVAL + 1).map((a) =>
  renderFeedArticle(
    feedArticle({
      id: a.id,
      slug: a.slug,
      title: a.title,
      heroImage: a.heroImage,
      authors: a.authors,
      topics: a.topics,
      publishedAt: a.publishedAt,
    }),
  ),
)

/** The whole feed: articles stacked vertically, one screen each, with ads between. */
const meta = {
  title: "Feed/FeedShell",
  component: FeedShell,
  globals: { theme: "dark" },
  parameters: { layout: "fullscreen" },
  // No next page, so the story never calls the load-more server action.
  args: { initialItems: items, initialNextCursor: null },
} satisfies Meta<typeof FeedShell>

export default meta
type Story = StoryObj<typeof meta>

/** Only the active article and its neighbours are mounted. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole("heading", { level: 1, name: items[0]!.article.title }),
    ).toBeVisible()
    await expect(canvas.getAllByRole("heading", { level: 1 })).toHaveLength(2)
  },
}

/** ↓ moves to the next article. */
export const KeyboardNext: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole("heading", { level: 1, name: items[0]!.article.title })
    await userEvent.keyboard("{ArrowDown}")
    // The third article mounts once the second is active.
    await waitFor(
      () =>
        expect(
          canvas.getByRole("heading", { level: 1, name: items[2]!.article.title }),
        ).toBeInTheDocument(),
      { timeout: 3000 },
    )
  },
}

/** Opened from a deep link: the pinned article's remembered page is where it starts. */
export const DeepLink: Story = {
  args: { initialPinnedArticleId: items[0]!.article.id, initialPageIndex: 2 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() =>
      expect(canvas.getAllByRole("tab", { selected: true })[0]).toHaveAccessibleName(
        `Go to page 3 of ${items[0]!.pages.length}`,
      ),
    )
  },
}
