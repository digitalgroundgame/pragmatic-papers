// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const { find, experiment } = vi.hoisted(() => ({ find: vi.fn(), experiment: { on: true } }))

vi.mock("@/utilities/getPayloadConfig", () => ({ getPayloadConfig: async () => ({ find }) }))
// The cache is Next's concern; the route's own job is which interactives it lists.
vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T): T => fn }))
vi.mock("@/globals/SiteSettings/isExperimentEnabled", () => ({
  isExperimentEnabled: async () => experiment.on,
}))
import sitemap from "../sitemap"

beforeEach(() => {
  vi.clearAllMocks()
  experiment.on = true
  process.env.SERVER_URL = "https://example.test"
})

describe("/interactives/sitemap.xml", () => {
  it("lists only published interactives, as readers see them", async () => {
    find.mockResolvedValue({ docs: [] })
    await sitemap()
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "interactives",
        overrideAccess: false,
        draft: false,
        where: { _status: { equals: "published" } },
      }),
    )
  })

  it("links each interactive's page with its last update", async () => {
    find.mockResolvedValue({
      docs: [
        { slug: "federal-courts", updatedAt: "2026-09-01T00:00:00.000Z" },
        { slug: "state-courts", updatedAt: "2026-09-02T00:00:00.000Z" },
      ],
    })
    await expect(sitemap()).resolves.toEqual([
      {
        url: "https://example.test/interactives/federal-courts",
        lastModified: "2026-09-01T00:00:00.000Z",
      },
      {
        url: "https://example.test/interactives/state-courts",
        lastModified: "2026-09-02T00:00:00.000Z",
      },
    ])
  })

  it("skips a document without a slug, and dates one without updatedAt to now", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-28T12:00:00.000Z"))
    find.mockResolvedValue({ docs: [{ slug: null }, { slug: "courts", updatedAt: null }] })
    const entries = await sitemap()
    vi.useRealTimers()
    expect(entries).toEqual([
      { url: "https://example.test/interactives/courts", lastModified: "2026-09-28T12:00:00.000Z" },
    ])
  })

  it("lists nothing, without reading the collection, while the experiment is off", async () => {
    experiment.on = false
    await expect(sitemap()).resolves.toEqual([])
    expect(find).not.toHaveBeenCalled()
  })
})
