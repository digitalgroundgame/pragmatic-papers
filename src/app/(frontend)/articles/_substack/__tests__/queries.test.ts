// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"

const find = vi.fn()
vi.mock("@/data/payload", () => ({
  getPayloadClient: vi.fn(async () => ({ find })),
}))

const { querySyndicatedArticleBySlug, querySyndicatedArticles } = await import("../queries")

const syndicated = {
  and: [{ _status: { equals: "published" } }, { syndicateToSubstack: { equals: true } }],
}

afterEach(() => {
  find.mockReset()
})

// The integration test (tests/integration/substackFeed.test.ts) checks what these select
// against a real database; these pin the query itself, so it can't silently widen to
// drafts or articles nobody opted in.
describe("querySyndicatedArticles", () => {
  it("asks for every published, syndicated article, newest first, as the public", async () => {
    find.mockResolvedValue({ docs: [{ slug: "one" }] })

    await expect(querySyndicatedArticles()).resolves.toEqual([{ slug: "one" }])
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "articles",
        draft: false,
        limit: 0,
        overrideAccess: false,
        where: syndicated,
        sort: "-publishedAt",
      }),
    )
  })
})

describe("querySyndicatedArticleBySlug", () => {
  it("adds the slug to the same filter", async () => {
    find.mockResolvedValue({ docs: [{ slug: "one" }] })

    await expect(querySyndicatedArticleBySlug("one")).resolves.toEqual({ slug: "one" })
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "articles",
        draft: false,
        overrideAccess: false,
        limit: 1,
        where: { and: [syndicated, { slug: { equals: "one" } }] },
      }),
    )
  })

  it("returns null when nothing matches", async () => {
    find.mockResolvedValue({ docs: [] })

    await expect(querySyndicatedArticleBySlug("missing")).resolves.toBeNull()
  })
})
