import { beforeEach, describe, expect, it, vi } from "vitest"

const mockRevalidateTag = vi.fn()
const mockPurgeEdgeCache = vi.fn()
vi.mock("next/cache", () => ({ revalidateTag: mockRevalidateTag }))
vi.mock("../purgeEdgeCache", () => ({ purgeEdgeCache: mockPurgeEdgeCache }))

const { revalidateRedirects } = await import("../revalidateRedirects")

const mockDoc = { id: 1, slug: "test-redirect" }

const makeArgs = (disableRevalidate: boolean) =>
  ({
    doc: mockDoc,
    req: {
      payload: { logger: { info: vi.fn() } },
      context: { disableRevalidate },
    },
  }) as never

beforeEach(() => {
  mockRevalidateTag.mockClear()
  mockPurgeEdgeCache.mockClear()
})

describe("revalidateRedirects", () => {
  it("calls revalidateTag when disableRevalidate is false", () => {
    revalidateRedirects(makeArgs(false))
    expect(mockRevalidateTag).toHaveBeenCalledWith("redirects", "max")
    expect(mockPurgeEdgeCache).toHaveBeenCalledWith(expect.anything(), "redirects changed")
  })

  it("does not call revalidateTag when disableRevalidate is true", () => {
    revalidateRedirects(makeArgs(true))
    expect(mockRevalidateTag).not.toHaveBeenCalled()
    expect(mockPurgeEdgeCache).not.toHaveBeenCalled()
  })

  it("always returns doc", () => {
    expect(revalidateRedirects(makeArgs(false))).toBe(mockDoc)
    expect(revalidateRedirects(makeArgs(true))).toBe(mockDoc)
  })
})
