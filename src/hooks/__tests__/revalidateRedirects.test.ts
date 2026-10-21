import { beforeEach, describe, expect, it, vi } from "vitest"

const mockRevalidateForReaders = vi.fn()
vi.mock("../revalidateForReaders", () => ({ revalidateForReaders: mockRevalidateForReaders }))

const { revalidateRedirects, revalidateRedirectsDelete } = await import("../revalidateRedirects")

const mockDoc = { id: 1, from: "/articles/old" }

const makeArgs = (disableRevalidate: boolean, previousDoc?: { from: string }) =>
  ({
    doc: mockDoc,
    previousDoc,
    req: {
      payload: { logger: { info: vi.fn() } },
      context: { disableRevalidate },
    },
  }) as never

beforeEach(() => {
  mockRevalidateForReaders.mockClear()
})

describe("revalidateRedirects", () => {
  it("clears the redirects tag and purges only the redirect's path", () => {
    revalidateRedirects(makeArgs(false, { from: "/articles/old" }))
    expect(mockRevalidateForReaders).toHaveBeenCalledWith(expect.anything(), "redirects changed", {
      tags: ["redirects"],
      purgeOnly: ["/articles/old", null],
    })
  })

  it("also purges the old path when the redirect's From URL changed", () => {
    revalidateRedirects(makeArgs(false, { from: "/articles/older" }))
    expect(mockRevalidateForReaders).toHaveBeenCalledWith(expect.anything(), "redirects changed", {
      tags: ["redirects"],
      purgeOnly: ["/articles/old", "/articles/older"],
    })
  })

  it("does nothing when disableRevalidate is true", () => {
    revalidateRedirects(makeArgs(true))
    expect(mockRevalidateForReaders).not.toHaveBeenCalled()
  })

  it("always returns doc", () => {
    expect(revalidateRedirects(makeArgs(false))).toBe(mockDoc)
    expect(revalidateRedirects(makeArgs(true))).toBe(mockDoc)
  })
})

describe("revalidateRedirectsDelete", () => {
  it("clears the redirects tag and purges the deleted redirect's path", () => {
    expect(revalidateRedirectsDelete(makeArgs(false))).toBe(mockDoc)
    expect(mockRevalidateForReaders).toHaveBeenCalledWith(expect.anything(), "redirect deleted", {
      tags: ["redirects"],
      purgeOnly: ["/articles/old"],
    })
  })

  it("does nothing when disableRevalidate is true", () => {
    expect(revalidateRedirectsDelete(makeArgs(true))).toBe(mockDoc)
    expect(mockRevalidateForReaders).not.toHaveBeenCalled()
  })
})
