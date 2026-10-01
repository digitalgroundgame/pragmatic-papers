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
  interactive: number | { id: number } | null
  _status?: "draft" | "published" | null
}

const logger = { info: vi.fn() }
const req = (disableRevalidate = false) => ({
  payload: { logger },
  context: { disableRevalidate },
})

const change = (doc: Snapshot, previousDoc?: Snapshot, disableRevalidate = false) =>
  ({ doc, previousDoc, req: req(disableRevalidate) }) as never

const published: Snapshot = { id: 9, interactive: 3, _status: "published" }
const drafted: Snapshot = { id: 9, interactive: 3, _status: "draft" }

beforeEach(() => {
  vi.clearAllMocks()
})

describe("revalidateSnapshot", () => {
  it("drops the interactive's data when a snapshot is published", () => {
    expect(revalidateSnapshot(change(published, drafted))).toBe(published)
    expect(revalidateTag).toHaveBeenCalledWith("interactive:3", "max")
    expect(purgeEdgeCache).toHaveBeenCalledWith(logger, "interactive 3 snapshot")
  })

  it("reads the interactive's id off a populated relationship too", () => {
    revalidateSnapshot(change({ ...published, interactive: { id: 3 } }))
    expect(revalidateTag).toHaveBeenCalledWith("interactive:3", "max")
  })

  it("drops caches when a published snapshot is unpublished", () => {
    revalidateSnapshot(change(drafted, published))
    expect(revalidateTag).toHaveBeenCalledWith("interactive:3", "max")
  })

  it("ignores a draft written over a draft — the sync's everyday write", () => {
    revalidateSnapshot(change(drafted, drafted))
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(purgeEdgeCache).not.toHaveBeenCalled()
  })

  it("does nothing for a snapshot with no interactive", () => {
    revalidateSnapshot(change({ ...published, interactive: null }))
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("does nothing when the caller disabled revalidation", () => {
    revalidateSnapshot(change(published, undefined, true))
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(purgeEdgeCache).not.toHaveBeenCalled()
  })
})

describe("revalidateSnapshotDelete", () => {
  it("drops the interactive's data", () => {
    expect(revalidateSnapshotDelete({ doc: published, req: req() } as never)).toBe(published)
    expect(revalidateTag).toHaveBeenCalledWith("interactive:3", "max")
    expect(purgeEdgeCache).toHaveBeenCalledOnce()
  })

  it("does nothing when the caller disabled revalidation", () => {
    revalidateSnapshotDelete({ doc: published, req: req(true) } as never)
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})
