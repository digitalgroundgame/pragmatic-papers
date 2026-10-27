// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
import { draftsCollection, readersRow } from "@/utilities/__tests__/readersCopyHelpers"

const { revalidateTag, purgeEdgeCache } = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  purgeEdgeCache: vi.fn(),
}))
vi.mock("next/cache", () => ({ revalidateTag }))
vi.mock("../purgeEdgeCache", () => ({ purgeEdgeCache }))

const { revalidateNavLinks, revalidateNavLinksDelete } = await import("../revalidateNavLinks")

const logger = { info: vi.fn(), warn: vi.fn() }
const findByID = readersRow()
interface Doc {
  id: number
  slug?: string
  _status?: "draft" | "published"
}

const change = (
  doc: Doc,
  previousDoc: Doc | undefined,
  { collection = "articles", operation = "update", disableRevalidate = false } = {},
) =>
  revalidateNavLinks({
    collection: collection === "topics" ? { slug: collection } : draftsCollection(collection),
    doc,
    previousDoc,
    operation,
    req: { payload: { logger, findByID }, context: { disableRevalidate } },
  } as never)

const navTags = () => revalidateTag.mock.calls.map(([tag]) => tag)

beforeEach(() => {
  vi.clearAllMocks()
})

describe("revalidateNavLinks", () => {
  it("drops both navs at once and purges the edge when a published slug changes", async () => {
    const doc = { id: 1, slug: "renamed", _status: "published" as const }
    expect(await change(doc, { id: 1, slug: "original", _status: "published" })).toBe(doc)

    expect(revalidateTag.mock.calls).toEqual([
      ["global_header", { expire: 0 }],
      ["global_footer", { expire: 0 }],
    ])
    expect(purgeEdgeCache).toHaveBeenCalledWith(logger, "articles original changed")
  })

  it("drops the navs when a linked document is unpublished or first published", async () => {
    await change({ id: 1, slug: "a", _status: "draft" }, { id: 1, slug: "a", _status: "published" })
    expect(navTags()).toEqual(["global_header", "global_footer"])

    revalidateTag.mockClear()
    await change({ id: 1, slug: "a", _status: "published" }, { id: 1, slug: "a", _status: "draft" })
    expect(navTags()).toEqual(["global_header", "global_footer"])
  })

  it("leaves the navs alone when an editor autosaves a published document, then publishes it", async () => {
    const editing = { id: 1, slug: "a", _status: "draft" as const }
    const published = { id: 1, slug: "a", _status: "published" as const }
    findByID.mockResolvedValueOnce(published)
    await change(editing, published)
    await revalidateNavLinks({
      collection: draftsCollection("articles"),
      doc: published,
      previousDoc: editing,
      operation: "update",
      req: {
        payload: { logger, findByID },
        context: { disableRevalidate: false, "readersCopy:articles:1": { copy: published } },
      },
    } as never)
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(purgeEdgeCache).not.toHaveBeenCalled()
  })

  it("follows a topic's slug, which has no drafts", async () => {
    await change({ id: 2, slug: "econ" }, { id: 2, slug: "economics" }, { collection: "topics" })
    expect(navTags()).toEqual(["global_header", "global_footer"])
  })

  it("leaves the navs alone when nothing a link shows changed", async () => {
    await change(
      { id: 1, slug: "a", _status: "published" },
      { id: 1, slug: "a", _status: "published" },
    )
    await change({ id: 1, slug: "b", _status: "draft" }, { id: 1, slug: "a", _status: "draft" })
    await change({ id: 2, slug: "econ" }, { id: 2, slug: "econ" }, { collection: "topics" })
    await change({ id: 3, slug: "new" }, undefined, { operation: "create" })
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(purgeEdgeCache).not.toHaveBeenCalled()
  })

  it("does nothing when revalidation is disabled", async () => {
    await change(
      { id: 1, slug: "renamed", _status: "published" },
      { id: 1, slug: "original", _status: "published" },
      { disableRevalidate: true },
    )
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})

describe("outside a Next request", () => {
  it("logs instead of failing the write when revalidateTag has no request scope", async () => {
    revalidateTag.mockImplementation(() => {
      throw new Error("Invariant: static generation store missing")
    })
    const doc = { id: 1, slug: "renamed", _status: "published" as const }
    await expect(change(doc, { id: 1, slug: "original", _status: "published" })).resolves.toBe(doc)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Invariant: static generation store missing"),
    )
    expect(purgeEdgeCache).toHaveBeenCalled()
    revalidateTag.mockReset()
  })
})

describe("revalidateNavLinksDelete", () => {
  const remove = (disableRevalidate: boolean) =>
    revalidateNavLinksDelete({
      collection: { slug: "pages" },
      doc: { id: 1, slug: "about" },
      req: { payload: { logger }, context: { disableRevalidate } },
    } as never)

  it("drops both navs when a document a link may point at is deleted", () => {
    remove(false)
    expect(navTags()).toEqual(["global_header", "global_footer"])
    expect(purgeEdgeCache).toHaveBeenCalledWith(logger, "pages about deleted")
  })

  it("does nothing when revalidation is disabled", () => {
    remove(true)
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})
