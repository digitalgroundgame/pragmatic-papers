import { beforeEach, describe, expect, it, vi } from "vitest"

const getFeedBatch = vi.fn()
vi.mock("../getFeedBatch", () => ({ getFeedBatch: (args: unknown) => getFeedBatch(args) }))
vi.mock("../renderFeedArticle", () => ({
  renderFeedArticle: (article: { id: number }) => ({ rendered: article.id }),
}))

const { loadFeedBatch } = await import("../actions")

describe("loadFeedBatch", () => {
  beforeEach(() => {
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
})
