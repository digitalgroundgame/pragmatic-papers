// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const { experiment, getFeedBatch, queryArticleBySlug, NOT_FOUND } = vi.hoisted(() => ({
  experiment: { on: true },
  getFeedBatch: vi.fn(),
  queryArticleBySlug: vi.fn(),
  NOT_FOUND: new Error("NEXT_NOT_FOUND"),
}))

vi.mock("@/globals/SiteSettings/isExperimentEnabled", () => ({
  isExperimentEnabled: async (name: string) => name === "feed" && experiment.on,
}))
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw NOT_FOUND
  },
}))
vi.mock("../getFeedBatch", () => ({
  getFeedBatch: (args: unknown) => getFeedBatch(args),
  withVolumes: async (articles: unknown[]) => articles,
}))
vi.mock("@/utilities/queries", () => ({
  queryArticleBySlug: (slug: string) => queryArticleBySlug(slug),
}))
vi.mock("../renderFeedArticle", () => ({
  renderFeedArticle: (article: { id: number }) => ({ id: article.id }),
}))
vi.mock("../FeedShell", () => ({ FeedShell: () => null }))

const { default: FeedPage } = await import("../page")
const { default: DeepLinkFeedPage } = await import("../[collection]/[slug]/page")

interface ShellProps {
  initialItems: Array<{ id: number }>
  initialNextCursor: number | null
  initialPinnedArticleId?: number
  initialPageIndex?: number
}
const props = (el: unknown): ShellProps => (el as { props: ShellProps }).props

const deepLink = (collection: string, slug: string, p?: string) =>
  DeepLinkFeedPage({
    params: Promise.resolve({ collection, slug }),
    searchParams: Promise.resolve(p === undefined ? {} : { p }),
  })

beforeEach(() => {
  experiment.on = true
  getFeedBatch.mockReset().mockResolvedValue({ items: [{ id: 1 }, { id: 2 }], nextCursor: 2 })
  queryArticleBySlug.mockReset().mockResolvedValue({ id: 2, slug: "two" })
})

describe("/feed", () => {
  it("404s while the feed experiment is off", async () => {
    experiment.on = false
    await expect(FeedPage()).rejects.toBe(NOT_FOUND)
    expect(getFeedBatch).not.toHaveBeenCalled()
  })

  it("renders the first batch into the shell when on", async () => {
    expect(props(await FeedPage())).toEqual({
      initialItems: [{ id: 1 }, { id: 2 }],
      initialNextCursor: 2,
    })
  })

  it("says so when there's nothing published yet", async () => {
    getFeedBatch.mockResolvedValue({ items: [], nextCursor: null })
    expect(JSON.stringify(props(await FeedPage()))).toContain("Nothing to read yet")
  })
})

describe("/feed/[collection]/[slug]", () => {
  it("404s while the feed experiment is off", async () => {
    experiment.on = false
    await expect(deepLink("articles", "two")).rejects.toBe(NOT_FOUND)
    expect(queryArticleBySlug).not.toHaveBeenCalled()
  })

  it("404s for anything but articles, and for an unknown slug", async () => {
    await expect(deepLink("volumes", "two")).rejects.toBe(NOT_FOUND)
    queryArticleBySlug.mockResolvedValue(null)
    await expect(deepLink("articles", "missing")).rejects.toBe(NOT_FOUND)
  })

  it("opens on the linked article and page, without repeating it", async () => {
    const shell = props(await deepLink("articles", "two", "3"))
    expect(shell.initialItems.map((a) => a.id)).toEqual([2, 1])
    expect(shell.initialPinnedArticleId).toBe(2)
    expect(shell.initialPageIndex).toBe(3)
  })

  it("puts an article from outside the first batch first", async () => {
    queryArticleBySlug.mockResolvedValue({ id: 9, slug: "nine" })
    const shell = props(await deepLink("articles", "nine", "nonsense"))
    expect(shell.initialItems.map((a) => a.id)).toEqual([9, 1, 2])
    expect(shell.initialPageIndex).toBe(0)
  })
})
