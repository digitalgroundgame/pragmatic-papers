import { beforeEach, describe, expect, it, vi } from "vitest"

const findGlobal = vi.fn()

vi.mock("payload", () => ({ getPayload: vi.fn(async () => ({ findGlobal })) }))
vi.mock("@payload-config", () => ({ default: Promise.resolve({}) }))

// `unstable_cache` needs an active Next.js request context to actually cache;
// here we only care about the arguments it's called with (the cache key).
const unstableCache = vi.fn(
  (fn: () => Promise<unknown>, _keyParts?: string[], _options?: { tags?: string[] }) => fn,
)
vi.mock("next/cache", () => ({
  unstable_cache: (...args: Parameters<typeof unstableCache>) => unstableCache(...args),
}))

const { getCachedGlobal } = await import("../getGlobals")

describe("getCachedGlobal", () => {
  beforeEach(() => {
    findGlobal.mockReset()
    unstableCache.mockClear()
    findGlobal.mockImplementation(async ({ slug, depth }: { slug: string; depth: number }) => ({
      slug,
      depth,
    }))
  })

  it("keys the cache by slug and depth so different depths don't collide", async () => {
    await getCachedGlobal("footer", 1)()
    await getCachedGlobal("footer", 2)()

    const keyParts = unstableCache.mock.calls.map(([, keys]) => keys)
    expect(keyParts).toEqual([
      ["footer", "1"],
      ["footer", "2"],
    ])
  })

  it("forwards the requested depth to payload.findGlobal", async () => {
    await getCachedGlobal("header", 3)()

    expect(findGlobal).toHaveBeenCalledWith({ slug: "header", depth: 3 })
  })

  it("defaults depth to 0 when not provided", async () => {
    await getCachedGlobal("footer")()

    expect(findGlobal).toHaveBeenCalledWith({ slug: "footer", depth: 0 })
    expect(unstableCache.mock.calls[0]?.[1]).toEqual(["footer", "0"])
  })
})
