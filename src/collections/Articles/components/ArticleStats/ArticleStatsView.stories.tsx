import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, fn, userEvent, within } from "storybook/test"

import type { ArticleStats } from "@/collections/Articles/stats/endpoint"
import { withPayloadAdminTheme } from "@/stories/payloadAdminTheme"

import { ArticleStatsView, type LoadArticleStats } from "./ArticleStatsView"

const minutesAgo = (minutes: number): string =>
  new Date(Date.now() - minutes * 60_000).toISOString()

const loaded = (overrides: Partial<ArticleStats> = {}): ArticleStats => ({
  published: true,
  analytics: {
    status: "ok",
    fetchedAt: minutesAgo(12),
    throttled: false,
    reportsUrl: null,
    figures: {
      allTime: { views: 18_240, readers: 12_310, readersWhoFinished: 5_420 },
      last30Days: { views: 2_150, readers: 1_640, readersWhoFinished: 690 },
      last7Days: { views: 310, readers: 240, readersWhoFinished: 101 },
      referrers: [
        { source: "google", views: 7_820 },
        { source: "(direct)", views: 4_110 },
        { source: "reddit.com", views: 2_960 },
        { source: "bsky.app", views: 1_240 },
      ],
    },
  },
  comments: { published: 14 },
  ranking: { position: 3, of: 20 },
  ...overrides,
})

const meta = {
  title: "Admin/Articles/Stats tab",
  component: ArticleStatsView,
  decorators: [withPayloadAdminTheme],
  args: { load: fn<LoadArticleStats>(async () => loaded()) },
} satisfies Meta<typeof ArticleStatsView>

export default meta
type Story = StoryObj<typeof meta>

/** A writer's view of their article: GA's figures, its comments and its ranking. */
export const Loaded: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const table = await canvas.findByRole("table", { name: "Readers, from Google Analytics" })
    await expect(within(table).getByRole("row", { name: /Views/ })).toHaveTextContent("18,240")
    // The share who read to the end, out of the readers.
    await expect(within(table).getByRole("row", { name: /Read to the end/ })).toHaveTextContent(
      "5,420 (44%)",
    )
    await expect(canvas.getByRole("list")).toHaveTextContent("google7,820 views")
    await expect(canvas.getByText(/Updated 12 minutes ago/)).toBeInTheDocument()
    await expect(canvas.getByText("14 published")).toBeInTheDocument()
    await expect(canvas.getByText(/Number 3 of the 20 articles/)).toBeInTheDocument()
    await expect(
      canvas.queryByRole("link", { name: "Open Google Analytics" }),
    ).not.toBeInTheDocument()

    await userEvent.click(canvas.getByRole("button", { name: "Refresh" }))
    await expect(args.load).toHaveBeenLastCalledWith(true)
  },
}

/** Editors also see held and hidden comments, and a link to GA's own reports. */
export const Editor: Story = {
  args: {
    load: fn<LoadArticleStats>(async () => {
      const stats = loaded({ comments: { published: 14, held: 2, hidden: 1 } })
      if (stats.analytics?.status === "ok") {
        stats.analytics.reportsUrl =
          "https://analytics.google.com/analytics/web/#/p123/reports/intelligenthome"
      }
      return stats
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText("14 published, 2 held by a check, 1 hidden"),
    ).toBeInTheDocument()
    await expect(canvas.getByRole("link", { name: "Open Google Analytics" })).toHaveAttribute(
      "rel",
      expect.stringContaining("noopener"),
    )
  },
}

/** Refresh within a minute of the last fetch keeps the figures and says why. */
export const RefreshTooSoon: Story = {
  args: {
    load: fn<LoadArticleStats>(async (refresh) => {
      const stats = loaded()
      if (refresh && stats.analytics?.status === "ok") {
        stats.analytics.throttled = true
        stats.analytics.fetchedAt = minutesAgo(0)
      }
      return stats
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole("button", { name: "Refresh" }))
    await expect(await canvas.findByRole("status")).toHaveTextContent(
      "fetched less than a minute ago",
    )
  },
}

/** Staging, previews and local dev have no GA property: the rest still shows. */
export const NoGoogleAnalytics: Story = {
  args: {
    load: fn<LoadArticleStats>(async () =>
      loaded({ analytics: { status: "unconfigured" }, comments: null, ranking: null }),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/isn't connected on this site/)).toBeInTheDocument()
    await expect(canvas.queryByRole("table")).not.toBeInTheDocument()
    await expect(canvas.queryByText("Comments")).not.toBeInTheDocument()
    await expect(canvas.getByText(/Not among the articles recommended/)).toBeInTheDocument()
  },
}

export const GoogleAnalyticsDown: Story = {
  args: {
    load: fn<LoadArticleStats>(async () => loaded({ analytics: { status: "error" } })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole("alert")).toHaveTextContent("couldn't be reached")
    await expect(canvas.getByRole("button", { name: "Refresh" })).toBeEnabled()
    await expect(canvas.getByText("14 published")).toBeInTheDocument()
  },
}

export const Unpublished: Story = {
  args: {
    load: fn<LoadArticleStats>(async () => ({
      published: false,
      analytics: null,
      comments: null,
      ranking: null,
    })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText("Stats appear once the article is published."),
    ).toBeInTheDocument()
  },
}

export const LoadFailed: Story = {
  args: {
    load: fn<LoadArticleStats>(async () => {
      throw new Error("Stats request failed: 500")
    }),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole("alert")).toHaveTextContent("couldn't be loaded")
    await userEvent.click(canvas.getByRole("button", { name: "Try again" }))
    await expect(args.load).toHaveBeenCalledTimes(2)
  },
}
