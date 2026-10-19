import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidatePath, revalidateTag, purgeEdgeCache } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  purgeEdgeCache: vi.fn(),
}))
vi.mock("next/cache", () => ({ revalidatePath, revalidateTag }))
vi.mock("@/hooks/purgeEdgeCache", () => ({ purgeEdgeCache }))

import type { Doc } from "@/payload-types"
import { draftsCollection, readersRow } from "@/utilities/__tests__/readersCopyHelpers"
import { revalidateDoc, revalidateDocDelete } from "../revalidateDoc"

type ChangeArgs = Parameters<typeof revalidateDoc>[0]
type DeleteArgs = Parameters<typeof revalidateDocDelete>[0]

const findByID = readersRow()
const logger = { info: vi.fn() }
const req = (context: Record<string, unknown> = {}) => ({
  payload: { logger, findByID },
  context,
})
const change = (doc: Partial<Doc>, previousDoc?: Partial<Doc>, context = {}) =>
  revalidateDoc({
    collection: draftsCollection("docs"),
    doc: { id: 1, ...doc },
    previousDoc: previousDoc && { id: 1, ...previousDoc },
    req: req(context),
  } as unknown as ChangeArgs)

beforeEach(() => vi.clearAllMocks())

describe("revalidateDoc", () => {
  // Every docs page reads the published tree from the `docs` tag, and the Worker keeps them
  // all under /docs, so a save refreshes the lot: moving or renaming a doc moves those under it.
  it("refreshes every docs page and the bell when a published doc is saved", async () => {
    await change({ slug: "a", _status: "published" })
    expect(revalidateTag).toHaveBeenCalledWith("docs", "max")
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith("/docs")
    expect(purgeEdgeCache).toHaveBeenCalledExactlyOnceWith(logger, "doc a", {
      paths: ["/docs"],
      shared: false,
      revalidated: { paths: ["/docs"], tags: ["docs"] },
    })
  })

  it("refreshes when a doc is unpublished", async () => {
    await change({ slug: "a", _status: "draft" }, { slug: "a", _status: "published" })
    expect(revalidateTag).toHaveBeenCalled()
  })

  it("leaves the cache alone for an autosave over a published doc", async () => {
    findByID.mockResolvedValueOnce({ id: 1, slug: "a", _status: "published" })
    await change({ slug: "a", _status: "draft" }, { slug: "a", _status: "published" })
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(purgeEdgeCache).not.toHaveBeenCalled()
  })

  it("leaves the cache alone for a draft readers never saw, or when told to", async () => {
    await change({ slug: "a", _status: "draft" })
    await change({ slug: "a", _status: "published" }, undefined, { disableRevalidate: true })
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(purgeEdgeCache).not.toHaveBeenCalled()
  })
})

describe("revalidateDocDelete", () => {
  it("refreshes every docs page", () => {
    revalidateDocDelete({ doc: { slug: "a" }, req: req() } as unknown as DeleteArgs)
    expect(revalidatePath).toHaveBeenCalledWith("/docs")
    expect(purgeEdgeCache).toHaveBeenCalledExactlyOnceWith(logger, "doc a deleted", {
      paths: ["/docs"],
      shared: false,
      revalidated: { paths: ["/docs"], tags: ["docs"] },
    })
  })

  it("does nothing when told to", () => {
    revalidateDocDelete({
      doc: { slug: "a" },
      req: req({ disableRevalidate: true }),
    } as unknown as DeleteArgs)
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
