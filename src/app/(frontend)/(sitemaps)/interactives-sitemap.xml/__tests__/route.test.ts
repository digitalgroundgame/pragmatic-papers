// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const { find, experiment } = vi.hoisted(() => ({ find: vi.fn(), experiment: { on: true } }))

vi.mock("@payload-config", () => ({ default: {} }))
vi.mock("payload", () => ({ getPayload: async () => ({ find }) }))
// The cache is Next's concern; the route's own job is which interactives it lists.
vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T): T => fn }))
vi.mock("@/globals/SiteSettings/isExperimentEnabled", () => ({
  isExperimentEnabled: async () => experiment.on,
}))
vi.mock("next-sitemap", () => ({
  getServerSideSitemap: (entries: unknown) => Response.json(entries),
}))

import { GET } from "../route"

beforeEach(() => {
  vi.clearAllMocks()
  experiment.on = true
  process.env.NEXT_PUBLIC_SERVER_URL = "https://example.test"
})

describe("GET /interactives-sitemap.xml", () => {
  it("lists only published interactives, as readers see them", async () => {
    find.mockResolvedValue({ docs: [] })
    await GET()
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
    const res = await GET()
    await expect(res.json()).resolves.toEqual([
      {
        loc: "https://example.test/interactives/federal-courts",
        lastmod: "2026-09-01T00:00:00.000Z",
      },
      {
        loc: "https://example.test/interactives/state-courts",
        lastmod: "2026-09-02T00:00:00.000Z",
      },
    ])
  })

  it("skips a document without a slug, and dates one without updatedAt to now", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-28T12:00:00.000Z"))
    find.mockResolvedValue({ docs: [{ slug: null }, { slug: "courts", updatedAt: null }] })
    const res = await GET()
    vi.useRealTimers()
    await expect(res.json()).resolves.toEqual([
      { loc: "https://example.test/interactives/courts", lastmod: "2026-09-28T12:00:00.000Z" },
    ])
  })

  it("lists nothing, without reading the collection, while the experiment is off", async () => {
    experiment.on = false
    const res = await GET()
    await expect(res.json()).resolves.toEqual([])
    expect(find).not.toHaveBeenCalled()
  })
})
