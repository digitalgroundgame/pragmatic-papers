// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { queryPublishedDocs } = vi.hoisted(() => ({ queryPublishedDocs: vi.fn() }))
vi.mock("@/plugins/docs/queries", () => ({ queryPublishedDocs }))

import sitemap from "../sitemap"

const SITE_URL = "https://pragmaticpapers.com"

beforeEach(() => vi.stubEnv("SERVER_URL", `${SITE_URL}/`))
afterEach(() => vi.unstubAllEnvs())

describe("/docs/sitemap.xml", () => {
  it("lists the /docs index, as fresh as its newest doc, and every doc with a slug", async () => {
    queryPublishedDocs.mockResolvedValue([
      { slug: "experiments", updatedAt: "2026-10-02T00:00:00.000Z" },
      { slug: null, updatedAt: "2026-10-05T00:00:00.000Z" },
      { slug: "unsplash-photos", updatedAt: "2026-10-08T00:00:00.000Z" },
    ])

    expect(await sitemap()).toEqual([
      { url: `${SITE_URL}/docs`, lastModified: "2026-10-08T00:00:00.000Z" },
      { url: `${SITE_URL}/docs/experiments`, lastModified: "2026-10-02T00:00:00.000Z" },
      { url: `${SITE_URL}/docs/unsplash-photos`, lastModified: "2026-10-08T00:00:00.000Z" },
    ])
  })

  it("is empty when there are no docs", async () => {
    queryPublishedDocs.mockResolvedValue([])
    expect(await sitemap()).toEqual([])
  })
})
