import { beforeEach, describe, expect, it, vi } from "vitest"

const { experiment } = vi.hoisted(() => ({ experiment: { on: true } }))
vi.mock("@/globals/SiteSettings/isExperimentEnabled", () => ({
  isExperimentEnabled: async (name: string) => name === "feed" && experiment.on,
}))
const getFeedBatch = vi.fn()
vi.mock("../getFeedBatch", () => ({
  getFeedBatch: (args: unknown) => getFeedBatch(args),
  MAX_FEED_PAGE: 50,
}))
vi.mock("../renderFeedArticle", () => ({
  renderFeedArticle: (article: { id: number }) => ({ rendered: article.id }),
}))

const { loadFeedBatch } = await import("../actions")

describe("loadFeedBatch", () => {
  beforeEach(() => {
    experiment.on = true
    getFeedBatch.mockReset().mockResolvedValue({ items: [{ id: 1 }, { id: 2 }], nextCursor: 3 })
  })

  it("renders the requested page of the feed", async () => {
    expect(await loadFeedBatch(2)).toEqual({
      items: [{ rendered: 1 }, { rendered: 2 }],
      nextCursor: 3,
    })
    expect(getFeedBatch).toHaveBeenCalledWith({ cursor: 2 })
  })

  it.each([
    [0, 1],
    [-4, 1],
    [Number.NaN, 1],
    [2.7, 2],
  ])("reads a cursor of %s as page %s", async (cursor, page) => {
    await loadFeedBatch(cursor)
    expect(getFeedBatch).toHaveBeenCalledWith({ cursor: page })
  })

  it.each([51, 1e9, Number.POSITIVE_INFINITY])(
    "serves nothing past the last page, without querying (cursor %s)",
    async (cursor) => {
      expect(await loadFeedBatch(cursor)).toEqual({ items: [], nextCursor: null })
      expect(getFeedBatch).not.toHaveBeenCalled()
    },
  )

  it("still serves the last page", async () => {
    await loadFeedBatch(50)
    expect(getFeedBatch).toHaveBeenCalledWith({ cursor: 50 })
  })

  it("serves nothing while the feed experiment is off", async () => {
    experiment.on = false
    expect(await loadFeedBatch(2)).toEqual({ items: [], nextCursor: null })
    expect(getFeedBatch).not.toHaveBeenCalled()
  })
})
