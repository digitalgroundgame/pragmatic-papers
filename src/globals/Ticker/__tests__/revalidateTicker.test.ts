import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockRevalidateTag, mockPurgeEdgeCache } = vi.hoisted(() => ({
  mockRevalidateTag: vi.fn(),
  mockPurgeEdgeCache: vi.fn(),
}))

vi.mock("next/cache", () => ({ revalidateTag: mockRevalidateTag }))
vi.mock("@/hooks/purgeEdgeCache", () => ({ purgeEdgeCache: mockPurgeEdgeCache }))

const { revalidateTicker } = await import("../hooks/revalidateTicker")

const doc = { hidden: [{ url: "https://x.com/PragPapers/status/42" }] }
const logger = { info: vi.fn() }

const args = (disableRevalidate: boolean) =>
  ({ doc, req: { payload: { logger }, context: { disableRevalidate } } }) as never

beforeEach(() => {
  vi.clearAllMocks()
})

describe("revalidateTicker", () => {
  it("clears the global, keeps the sources' cached posts, and purges the edge", () => {
    expect(revalidateTicker(args(false))).toBe(doc)
    expect(mockRevalidateTag).toHaveBeenCalledWith("global_ticker", "max")
    expect(mockRevalidateTag).not.toHaveBeenCalledWith("ticker", "max")
    expect(mockPurgeEdgeCache).toHaveBeenCalledWith(logger, "ticker saved")
  })

  it("does nothing when revalidation is disabled", () => {
    expect(revalidateTicker(args(true))).toBe(doc)
    expect(mockRevalidateTag).not.toHaveBeenCalled()
    expect(mockPurgeEdgeCache).not.toHaveBeenCalled()
  })
})
