// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { find } = vi.hoisted(() => ({ find: vi.fn() }))
vi.mock("@/data/payload", () => ({ getPayloadClient: async () => ({ find }) }))

import sitemap from "../sitemap"

const SITE_URL = "https://pragmaticpapers.com"

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("SERVER_URL", `${SITE_URL}/`)
})
afterEach(() => vi.unstubAllEnvs())

describe("/topics/sitemap.xml", () => {
  it("lists the authors /topics lists", async () => {
    find.mockResolvedValue({ docs: [] })
    await sitemap()
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "topics",
        overrideAccess: false,
        select: { slug: true, updatedAt: true },
      }),
    )
  })

  it("links /topics, as fresh as its newest topic, and every topic with a slug", async () => {
    find.mockResolvedValue({
      docs: [
        { slug: "economy", updatedAt: "2026-10-02T00:00:00.000Z" },
        { slug: null, updatedAt: "2026-10-05T00:00:00.000Z" },
        { slug: "housing", updatedAt: "2026-10-08T00:00:00.000Z" },
      ],
    })
    expect(await sitemap()).toEqual([
      { url: `${SITE_URL}/topics`, lastModified: "2026-10-08T00:00:00.000Z" },
      { url: `${SITE_URL}/topics/economy`, lastModified: "2026-10-02T00:00:00.000Z" },
      { url: `${SITE_URL}/topics/housing`, lastModified: "2026-10-08T00:00:00.000Z" },
    ])
  })

  it("is empty when there are no topics", async () => {
    find.mockResolvedValue({ docs: [] })
    expect(await sitemap()).toEqual([])
  })
})
