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

const { revalidateSiteSettings } = await import("../hooks/revalidateSiteSettings")

const doc = { experiments: { interactives: true } }
const logger = { info: vi.fn() }

const args = (disableRevalidate: boolean) =>
  ({ doc, req: { payload: { logger }, context: { disableRevalidate } } }) as never

beforeEach(() => {
  vi.clearAllMocks()
})

describe("revalidateSiteSettings", () => {
  it("clears Next's cache and purges the edge", () => {
    expect(revalidateSiteSettings(args(false))).toBe(doc)
    expect(mockRevalidateTag).toHaveBeenCalledWith("global_site-settings", "max")
    expect(mockRevalidatePath).toHaveBeenCalledWith("/", "layout")
    expect(mockPurgeEdgeCache).toHaveBeenCalledWith(logger, "site settings saved")
  })

  it("does nothing when revalidation is disabled", () => {
    expect(revalidateSiteSettings(args(true))).toBe(doc)
    expect(mockRevalidateTag).not.toHaveBeenCalled()
    expect(mockPurgeEdgeCache).not.toHaveBeenCalled()
  })
})
