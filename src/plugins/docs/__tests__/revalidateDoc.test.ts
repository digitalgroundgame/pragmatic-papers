import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidatePath, revalidateTag, purgeEdgeCache } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  purgeEdgeCache: vi.fn(),
}))
vi.mock("next/cache", () => ({ revalidatePath, revalidateTag }))
vi.mock("@/hooks/purgeEdgeCache", () => ({ purgeEdgeCache }))

import type { Doc } from "@/payload-types"
import { revalidateDoc, revalidateDocDelete } from "../revalidateDoc"

type ChangeArgs = Parameters<typeof revalidateDoc>[0]
type DeleteArgs = Parameters<typeof revalidateDocDelete>[0]

const req = (context: Record<string, unknown> = {}) => ({ payload: { logger: {} }, context })
const change = (doc: Partial<Doc>, previousDoc?: Partial<Doc>, context = {}) =>
  revalidateDoc({ doc, previousDoc, req: req(context) } as unknown as ChangeArgs)

beforeEach(() => vi.clearAllMocks())

describe("revalidateDoc", () => {
  it("refreshes the index, the doc and the bell when a published doc is saved", () => {
    change({ slug: "a", _status: "published" })
    expect(revalidateTag).toHaveBeenCalledWith("docs", "max")
    expect(revalidatePath).toHaveBeenCalledWith("/docs")
    expect(revalidatePath).toHaveBeenCalledWith("/docs/a")
    expect(purgeEdgeCache).toHaveBeenCalledOnce()
  })

  it("refreshes the old URL when a published doc's slug changes", () => {
    change({ slug: "b", _status: "published" }, { slug: "a", _status: "published" })
    expect(revalidatePath).toHaveBeenCalledWith("/docs/a")
    expect(revalidatePath).toHaveBeenCalledWith("/docs/b")
  })

  it("refreshes when a doc is unpublished", () => {
    change({ slug: "a", _status: "draft" }, { slug: "a", _status: "published" })
    expect(revalidateTag).toHaveBeenCalled()
  })

  it("leaves the cache alone for a draft readers never saw, or when told to", () => {
    change({ slug: "a", _status: "draft" })
    change({ slug: "a", _status: "published" }, undefined, { disableRevalidate: true })
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(purgeEdgeCache).not.toHaveBeenCalled()
  })
})

describe("revalidateDocDelete", () => {
  it("refreshes the index and the deleted doc's page", () => {
    revalidateDocDelete({ doc: { slug: "a" }, req: req() } as unknown as DeleteArgs)
    expect(revalidatePath).toHaveBeenCalledWith("/docs/a")
    expect(purgeEdgeCache).toHaveBeenCalledOnce()
  })

  it("does nothing when told to", () => {
    revalidateDocDelete({
      doc: { slug: "a" },
      req: req({ disableRevalidate: true }),
    } as unknown as DeleteArgs)
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
