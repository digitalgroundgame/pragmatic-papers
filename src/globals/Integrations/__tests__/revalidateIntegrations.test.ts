import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockRevalidateTag, mockPurgeEdgeCache } = vi.hoisted(() => ({
  mockRevalidateTag: vi.fn(),
  mockPurgeEdgeCache: vi.fn(),
}))

vi.mock("next/cache", () => ({ revalidateTag: mockRevalidateTag }))
vi.mock("@/hooks/purgeEdgeCache", () => ({ purgeEdgeCache: mockPurgeEdgeCache }))

const { revalidateIntegrations } = await import("../hooks/revalidateIntegrations")

const doc = { bluesky: { handles: [{ handle: "someone.bsky.social" }] } }
const logger = { info: vi.fn() }

const args = (disableRevalidate: boolean) =>
  ({ doc, req: { payload: { logger }, context: { disableRevalidate } } }) as never

beforeEach(() => {
  vi.clearAllMocks()
})

describe("revalidateIntegrations", () => {
  it("clears the global and the ticker's cached answers, and purges the edge", () => {
    expect(revalidateIntegrations(args(false))).toBe(doc)
    expect(mockRevalidateTag).toHaveBeenCalledWith("global_integrations", "max")
    expect(mockRevalidateTag).toHaveBeenCalledWith("ticker", "max")
    expect(mockPurgeEdgeCache).toHaveBeenCalledWith(logger, "integrations saved")
  })

  it("does nothing when revalidation is disabled", () => {
    expect(revalidateIntegrations(args(true))).toBe(doc)
    expect(mockRevalidateTag).not.toHaveBeenCalled()
    expect(mockPurgeEdgeCache).not.toHaveBeenCalled()
  })
})
