import { beforeEach, describe, expect, it, vi } from "vitest"

const findGlobal = vi.fn()

vi.mock("@/data/payload", () => ({
  getPayloadClient: vi.fn(async () => ({ findGlobal })),
}))

// `unstable_cache` needs an active Next.js request context to cache; here the
// global is read on every call.
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => Promise<unknown>) => fn }))

const { isExperimentEnabled } = await import("../isExperimentEnabled")

describe("isExperimentEnabled", () => {
  beforeEach(() => {
    findGlobal.mockReset()
  })

  it("is true when the experiment is switched on", async () => {
    findGlobal.mockResolvedValue({ experiments: { feed: true, interactives: false } })

    expect(await isExperimentEnabled("feed")).toBe(true)
    expect(findGlobal).toHaveBeenCalledWith({ slug: "site-settings", depth: 0 })
  })

  it("is false when the experiment is switched off", async () => {
    findGlobal.mockResolvedValue({ experiments: { feed: true, interactives: false } })

    expect(await isExperimentEnabled("interactives")).toBe(false)
  })

  it.each([
    ["the global has never been saved", {}],
    ["the group is null", { experiments: null }],
    ["the checkbox is null", { experiments: { feed: null } }],
  ])("is false when %s", async (_, settings) => {
    findGlobal.mockResolvedValue(settings)

    expect(await isExperimentEnabled("feed")).toBe(false)
  })
})
