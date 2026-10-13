import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag, purgeEdgeCache } = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  purgeEdgeCache: vi.fn(),
}))
vi.mock("next/cache", () => ({ revalidateTag }))
vi.mock("@/hooks/purgeEdgeCache", () => ({ purgeEdgeCache }))

import { revalidateSnapshot, revalidateSnapshotDelete } from "../revalidateSnapshot"

interface Snapshot {
  id: number
  interactive: number | { id: number; slug?: string } | null
  _status?: "draft" | "published" | null
}

const logger = { info: vi.fn() }
const findByID = vi.fn()
const req = (disableRevalidate = false) => ({
  payload: { logger, findByID },
  context: { disableRevalidate },
})

const change = (doc: Snapshot, previousDoc?: Snapshot, disableRevalidate = false) =>
  ({ doc, previousDoc, req: req(disableRevalidate) }) as never

const published: Snapshot = { id: 9, interactive: 3, _status: "published" }
const drafted: Snapshot = { id: 9, interactive: 3, _status: "draft" }

beforeEach(() => {
  vi.clearAllMocks()
  findByID.mockResolvedValue({ id: 3, slug: "courts" })
})

describe("revalidateSnapshot", () => {
  it("drops the interactive's data and its page when a snapshot is published", async () => {
    expect(await revalidateSnapshot(change(published, drafted))).toBe(published)
    expect(revalidateTag).toHaveBeenCalledWith("interactive:3", "max")
    expect(purgeEdgeCache).toHaveBeenCalledWith(logger, "interactive 3 snapshot", {
      paths: ["/interactives/courts"],
      shared: false,
      revalidated: { paths: [], tags: ["interactive:3"] },
    })
  })

  it("reads the interactive in the save's transaction", async () => {
    const args = change(published, drafted) as { req: unknown }
    await revalidateSnapshot(args as never)
    expect(findByID).toHaveBeenCalledWith(expect.objectContaining({ req: args.req, id: 3 }))
  })

  it("reads the interactive off a populated relationship too", async () => {
    await revalidateSnapshot(change({ ...published, interactive: { id: 3, slug: "courts" } }))
    expect(revalidateTag).toHaveBeenCalledWith("interactive:3", "max")
    expect(findByID).not.toHaveBeenCalled()
    expect(purgeEdgeCache).toHaveBeenCalledWith(logger, "interactive 3 snapshot", {
      paths: ["/interactives/courts"],
      shared: false,
      revalidated: { paths: [], tags: ["interactive:3"] },
    })
  })

  it("purges every page when the interactive can't be read", async () => {
    findByID.mockRejectedValue(new Error("not found"))
    await revalidateSnapshot(change(published, drafted))
    expect(purgeEdgeCache).toHaveBeenCalledWith(logger, "interactive 3 snapshot", {
      paths: [null],
      shared: false,
      revalidated: { paths: [], tags: ["interactive:3"] },
    })
  })

  it("drops caches when a published snapshot is unpublished", async () => {
    await revalidateSnapshot(change(drafted, published))
    expect(revalidateTag).toHaveBeenCalledWith("interactive:3", "max")
  })

  it("ignores a draft written over a draft — the sync's everyday write", async () => {
    await revalidateSnapshot(change(drafted, drafted))
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(purgeEdgeCache).not.toHaveBeenCalled()
  })

  it("does nothing for a snapshot with no interactive", async () => {
    await revalidateSnapshot(change({ ...published, interactive: null }))
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("does nothing when the caller disabled revalidation", async () => {
    await revalidateSnapshot(change(published, undefined, true))
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(purgeEdgeCache).not.toHaveBeenCalled()
  })
})

describe("revalidateSnapshotDelete", () => {
  it("drops the interactive's data", async () => {
    expect(await revalidateSnapshotDelete({ doc: published, req: req() } as never)).toBe(published)
    expect(revalidateTag).toHaveBeenCalledWith("interactive:3", "max")
    expect(purgeEdgeCache).toHaveBeenCalledOnce()
  })

  it("does nothing when the caller disabled revalidation", async () => {
    await revalidateSnapshotDelete({ doc: published, req: req(true) } as never)
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})
