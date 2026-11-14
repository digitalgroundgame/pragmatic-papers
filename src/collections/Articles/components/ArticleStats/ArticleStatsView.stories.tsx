import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, fn, userEvent, within } from "storybook/test"

import type { ArticleStats } from "@/collections/Articles/stats/endpoint"
import { withPayloadAdminTheme } from "@/stories/payloadAdminTheme"

import { ArticleStatsView, type LoadArticleStats } from "./ArticleStatsView"

const minutesAgo = (minutes: number): string =>
  new Date(Date.now() - minutes * 60_000).toISOString()

/** The row of the readers table a figure heads. */
const figureRow = (table: HTMLElement, name: string): HTMLElement => {
  const row = within(table).getByRole("rowheader", { name }).closest("tr")
  if (!row) throw new Error(`No row for ${name}`)
  return row
}

const loaded = (overrides: Partial<ArticleStats> = {}): ArticleStats => ({
  published: true,
  narration: true,
  publishedOn: "2026-11-01",
  views: { allTime: 24_610, last30Days: 2_980, last7Days: 420, countingSince: "2026-10-20" },
  analytics: {
    status: "ok",
    fetchedAt: minutesAgo(12),
    throttled: false,
    reportsUrl: null,
    figures: {
      allTime: { views: 18_240, readers: 12_310, readersWhoFinished: 5_420, eventCount: 2_830 },
      last30Days: { views: 2_150, readers: 1_640, readersWhoFinished: 690, eventCount: 410 },
      last7Days: { views: 310, readers: 240, readersWhoFinished: 101, eventCount: 57 },
      referrers: [
        { source: "google", views: 7_820 },
        { source: "(direct)", views: 4_110 },
        { source: "reddit.com", views: 2_960 },
        { source: "bsky.app", views: 1_240 },
      ],
    },
  },
  comments: { published: 14, url: "https://pragmaticpapers.com/articles/a-slug#comments" },
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

/** A writer's view of their article: our count, GA's figures, its comments and its ranking. */
export const Loaded: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const table = await canvas.findByRole("table", { name: "Readers" })
    // Our own count comes first, with GA's lower one under it.
    const rows = within(table).getAllByRole("rowheader")
    await expect(rows.map((row) => row.textContent)).toEqual([
      "Views",
      "Views in Google Analytics",
      "Readers",
      "Read to the end",
      "Narration plays",
    ])
    await expect(figureRow(table, "Views")).toHaveTextContent("24,610")
    await expect(figureRow(table, "Views in Google Analytics")).toHaveTextContent("18,240")
    // The share who read to the end, out of the readers.
    await expect(figureRow(table, "Read to the end")).toHaveTextContent("5,420 (44%)")
    // Plays of the article's narration, beside its readers.
    await expect(figureRow(table, "Narration plays")).toHaveTextContent("2,830")
    await expect(canvas.getByText(/Views is our own count: one for each visit/)).toBeInTheDocument()
    const referrers = canvas.getByRole("table", { name: "Where readers came from" })
    await expect(within(referrers).getByRole("row", { name: /google/ })).toHaveTextContent("7,820")
    await expect(canvas.getByText(/updated 12 minutes ago/)).toBeInTheDocument()
    // The undercount notice comes before the figures, so writers read it first.
    const notice = canvas.getByRole("note")
    await expect(notice).toHaveTextContent("More people read this than Google Analytics shows")
    await expect(notice).toHaveTextContent("ad blockers")
    // Published after counting began, so there's nothing missing from our count.
    await expect(canvas.queryByText(/since we started counting/)).not.toBeInTheDocument()
    await expect(
      notice.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    await expect(canvas.getByText("14 published")).toBeInTheDocument()
    // Comments opens the comment section under the article on the site.
    await expect(canvas.getByRole("link", { name: "Comments" })).toHaveAttribute(
      "href",
      "https://pragmaticpapers.com/articles/a-slug#comments",
    )
    await expect(canvas.queryByRole("link", { name: "Moderate" })).not.toBeInTheDocument()
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
      const stats = loaded({
        comments: {
          published: 14,
          held: 2,
          hidden: 1,
          url: "https://pragmaticpapers.com/articles/a-slug#comments",
          moderateUrl: "/admin/collections/comments?where%5Btarget%5D%5Bequals%5D=7",
        },
      })
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
      await canvas.findByText(/14 published, 2 held by a check, 1 hidden/),
    ).toBeInTheDocument()
    await expect(canvas.getByRole("link", { name: "Moderate" })).toHaveAttribute(
      "href",
      "/admin/collections/comments?where%5Btarget%5D%5Bequals%5D=7",
    )
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

/** An article that came out before we started counting: its earlier views aren't in Views. */
export const PublishedBeforeCounting: Story = {
  args: { load: fn<LoadArticleStats>(async () => loaded({ publishedOn: "2026-03-03" })) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const notice = (await canvas.findAllByRole("note")).find((note) =>
      note.textContent?.includes("since we started counting"),
    )
    await expect(notice).toHaveTextContent(
      "We started counting views on October 20, 2026, and this article came out on March 3, 2026",
    )
    await expect(notice).toHaveTextContent("Google Analytics' figures since publication include")
  },
}

/** An article with no narration has no plays to count. */
export const WithoutNarration: Story = {
  args: { load: fn<LoadArticleStats>(async () => loaded({ narration: false })) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const table = await canvas.findByRole("table", { name: "Readers" })
    await expect(
      within(table).queryByRole("rowheader", { name: "Narration plays" }),
    ).not.toBeInTheDocument()
  },
}

/** Our count couldn't be read: GA's figures still show, under their own name. */
export const ViewCountUnavailable: Story = {
  args: { load: fn<LoadArticleStats>(async () => loaded({ views: null })) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const table = await canvas.findByRole("table", { name: "Readers" })
    await expect(figureRow(table, "Views")).toHaveTextContent("18,240")
    await expect(canvas.getByRole("alert")).toHaveTextContent("Our view count couldn't be read")
    await expect(canvas.getByRole("note")).toHaveTextContent("Treat its figures as a floor")
  },
}

/** Staging, previews and local dev have no GA property: our count and the rest still show. */
export const NoGoogleAnalytics: Story = {
  args: {
    load: fn<LoadArticleStats>(async () =>
      loaded({ analytics: { status: "unconfigured" }, comments: null, ranking: null }),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/isn't connected on this site/)).toBeInTheDocument()
    const table = canvas.getByRole("table", { name: "Readers" })
    await expect(within(table).getAllByRole("rowheader")).toHaveLength(1)
    await expect(figureRow(table, "Views")).toHaveTextContent("24,610")
    // No GA figures, so nothing to caveat.
    await expect(canvas.queryByRole("note")).not.toBeInTheDocument()
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
      narration: false,
      publishedOn: null,
      views: null,
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
