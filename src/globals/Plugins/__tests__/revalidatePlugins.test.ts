import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockRevalidateTag, mockRevalidatePath, mockPurgeEdgeCache } = vi.hoisted(() => ({
  mockRevalidateTag: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockPurgeEdgeCache: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidateTag: mockRevalidateTag,
  revalidatePath: mockRevalidatePath,
}))
vi.mock("@/hooks/purgeEdgeCache", () => ({ purgeEdgeCache: mockPurgeEdgeCache }))

const { revalidatePlugins } = await import("../hooks/revalidatePlugins")

const doc = { switches: { docs: true } }
const logger = { info: vi.fn() }

const args = (disableRevalidate: boolean) =>
  ({ doc, req: { payload: { logger }, context: { disableRevalidate } } }) as never

beforeEach(() => {
  vi.clearAllMocks()
})

describe("revalidatePlugins", () => {
  it("clears Next's cache and purges the edge", () => {
    expect(revalidatePlugins(args(false))).toBe(doc)
    expect(mockRevalidateTag).toHaveBeenCalledWith("global_plugins", "max")
    expect(mockRevalidatePath).toHaveBeenCalledWith("/", "layout")
    expect(mockPurgeEdgeCache).toHaveBeenCalledWith(logger, "plugin switches saved")
  })

  it("does nothing when revalidation is disabled", () => {
    expect(revalidatePlugins(args(true))).toBe(doc)
    expect(mockRevalidateTag).not.toHaveBeenCalled()
    expect(mockPurgeEdgeCache).not.toHaveBeenCalled()
  })
})
