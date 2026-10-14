// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidatePath, revalidateTag, purgeEdgeCache } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  purgeEdgeCache: vi.fn(),
}))
vi.mock("next/cache", () => ({ revalidatePath, revalidateTag }))
vi.mock("../purgeEdgeCache", () => ({ purgeEdgeCache }))

const { revalidateForReaders } = await import("../revalidateForReaders")

const logger = { info: vi.fn() } as never

beforeEach(() => vi.clearAllMocks())

describe("revalidateForReaders", () => {
  it("revalidates each path and tag, and tells the purge exactly those", () => {
    revalidateForReaders(logger, "article a", {
      paths: ["/articles/a", null, "/volumes/1"],
      tags: ["articles-sitemap"],
      purgeOnly: ["/topics/t", undefined],
      shared: true,
    })

    expect(revalidatePath.mock.calls).toEqual([["/articles/a"], ["/volumes/1"], ["/"]])
    expect(revalidateTag).toHaveBeenCalledExactlyOnceWith("articles-sitemap", "max")
    expect(purgeEdgeCache).toHaveBeenCalledExactlyOnceWith(logger, "article a", {
      paths: ["/articles/a", "/volumes/1", "/", "/topics/t", undefined],
      shared: true,
      revalidated: { paths: ["/articles/a", "/volumes/1", "/"], tags: ["articles-sitemap"] },
    })
  })

  it("revalidates the prerendered home page once with the shared pages", () => {
    revalidateForReaders(logger, "page home", { paths: ["/"], shared: true })

    expect(revalidatePath.mock.calls).toEqual([["/"]])
  })

  it("leaves the home page alone when the save shows on no shared page", () => {
    revalidateForReaders(logger, "page about", { paths: ["/about"] })

    expect(revalidatePath.mock.calls).toEqual([["/about"]])
  })

  it("never calls revalidatePath on a page it only purges", () => {
    revalidateForReaders(logger, "interactive a", {
      tags: ["interactive:1"],
      purgeOnly: ["/interactives/a"],
    })

    expect(revalidatePath).not.toHaveBeenCalled()
    expect(purgeEdgeCache).toHaveBeenCalledWith(logger, "interactive a", {
      paths: ["/interactives/a"],
      shared: false,
      revalidated: { paths: [], tags: ["interactive:1"] },
    })
  })
})
