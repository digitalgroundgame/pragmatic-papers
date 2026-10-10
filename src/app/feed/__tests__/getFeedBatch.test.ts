import { beforeEach, describe, expect, it, vi } from "vitest"

const find = vi.fn()
vi.mock("@/data/payload", () => ({
  getPayloadClient: vi.fn(async () => ({ find })),
}))
const queryVolumesForArticles = vi.fn()
vi.mock("@/data/queries", () => ({
  queryVolumesForArticles: (ids: number[]) => queryVolumesForArticles(ids),
}))

const { getFeedBatch, MAX_FEED_PAGE, rankFeed, withVolumes } = await import("../getFeedBatch")

const DAY = 24 * 60 * 60 * 1000
const daysAgo = (n: number): string => new Date(Date.now() - n * DAY).toISOString()

describe("rankFeed", () => {
  it("returns short lists untouched", () => {
    const one = [{ id: 1, publishedAt: daysAgo(1) }]
    expect(rankFeed(one, 1)).toBe(one)
    expect(rankFeed([], 1)).toEqual([])
  })

  it("puts every article from a newer week before any from an older week", () => {
    const thisWeek = [1, 2, 3].map((id) => ({ id, publishedAt: daysAgo(id) }))
    const lastMonth = [4, 5, 6].map((id) => ({ id, publishedAt: daysAgo(28 + id) }))

    const ranked = rankFeed([...lastMonth, ...thisWeek], 42)

    expect(ranked.slice(0, 3).map((a) => a.id)).toEqual(expect.arrayContaining([1, 2, 3]))
    expect(ranked.slice(3).map((a) => a.id)).toEqual(expect.arrayContaining([4, 5, 6]))
  })

  it("ranks undated articles last", () => {
    const ranked = rankFeed(
      [
        { id: 1, publishedAt: null },
        { id: 2, publishedAt: daysAgo(400) },
        { id: 3, publishedAt: daysAgo(2) },
      ],
      7,
    )
    expect(ranked.map((a) => a.id)).toEqual([3, 2, 1])
  })

  it("is deterministic for a seed and shuffles within a week", () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ id: i, publishedAt: daysAgo(1) }))
    const a = rankFeed([...items], 123).map((x) => x.id)
    const b = rankFeed([...items], 123).map((x) => x.id)
    expect(a).toEqual(b)

    const orders = new Set(
      [1, 2, 3, 4, 5].map((seed) =>
        rankFeed([...items], seed)
          .map((x) => x.id)
          .join(),
      ),
    )
    expect(orders.size).toBeGreaterThan(1)
  })
})

describe("withVolumes", () => {
  beforeEach(() => queryVolumesForArticles.mockReset())

  it("attaches the containing volume in one lookup", async () => {
    queryVolumesForArticles.mockResolvedValue([
      { id: 10, title: "Volume I", slug: "volume-i", articles: [1, { id: 2 }] },
    ])

    const out = await withVolumes([{ id: 1 }, { id: 2 }, { id: 3 }] as never)

    expect(queryVolumesForArticles).toHaveBeenCalledOnce()
    expect(queryVolumesForArticles).toHaveBeenCalledWith([1, 2, 3])
    expect(out.map((a) => a.volume)).toEqual([
      { id: 10, title: "Volume I", slug: "volume-i" },
      { id: 10, title: "Volume I", slug: "volume-i" },
      null,
    ])
  })
})

describe("getFeedBatch", () => {
  beforeEach(() => {
    find.mockReset()
    queryVolumesForArticles.mockReset().mockResolvedValue([])
  })

  it("reads one page of published articles as the public", async () => {
    find.mockResolvedValue({ docs: [{ id: 1, publishedAt: daysAgo(1) }], hasNextPage: true })

    const batch = await getFeedBatch({ cursor: 3, limit: 5 })

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "articles",
        draft: false,
        overrideAccess: false,
        where: { _status: { equals: "published" } },
        limit: 5,
        page: 3,
      }),
    )
    expect(batch.items.map((a) => a.id)).toEqual([1])
    expect(batch.nextCursor).toBe(4)
  })

  it("starts at page 1 and stops paging on the last page", async () => {
    find.mockResolvedValue({ docs: [], hasNextPage: false })

    const batch = await getFeedBatch({ cursor: null })

    expect(find).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 8 }))
    expect(batch).toEqual({ items: [], nextCursor: null })
  })

  it("stops offering more at the deepest page it serves", async () => {
    find.mockResolvedValue({ docs: [{ id: 1, publishedAt: daysAgo(1) }], hasNextPage: true })

    expect((await getFeedBatch({ cursor: MAX_FEED_PAGE - 1 })).nextCursor).toBe(MAX_FEED_PAGE)
    expect((await getFeedBatch({ cursor: MAX_FEED_PAGE })).nextCursor).toBeNull()
  })
})
