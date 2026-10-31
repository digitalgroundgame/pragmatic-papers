// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { queryPublishedDocs, experiment } = vi.hoisted(() => ({
  queryPublishedDocs: vi.fn(),
  experiment: { enabled: true },
}))
vi.mock("@/plugins/docs/queries", () => ({ queryPublishedDocs }))
vi.mock("@/globals/Plugins/isPluginEnabled", () => ({
  isPluginEnabled: async () => experiment.enabled,
}))

import sitemap from "../sitemap"

const SITE_URL = "https://pragmaticpapers.com"

beforeEach(() => {
  vi.stubEnv("SERVER_URL", `${SITE_URL}/`)
  experiment.enabled = true
})
afterEach(() => vi.unstubAllEnvs())

describe("/docs/sitemap.xml", () => {
  it("lists every doc at its place in the tree, the home doc at /docs, and What's new as fresh as the newest", async () => {
    const doc = (id: number, slug: string | null, updatedAt: string, parent?: number) => ({
      id,
      slug,
      title: slug ?? "Untitled",
      parent,
      updatedAt,
    })
    queryPublishedDocs.mockResolvedValue([
      doc(1, "home", "2026-10-01T00:00:00.000Z"),
      doc(2, "experiments", "2026-10-02T00:00:00.000Z", 4),
      doc(3, null, "2026-10-05T00:00:00.000Z"),
      doc(4, "editing", "2026-10-08T00:00:00.000Z"),
    ])

    expect(await sitemap()).toEqual([
      { url: `${SITE_URL}/docs`, lastModified: "2026-10-01T00:00:00.000Z" },
      { url: `${SITE_URL}/docs/editing/experiments`, lastModified: "2026-10-02T00:00:00.000Z" },
      { url: `${SITE_URL}/docs/editing`, lastModified: "2026-10-08T00:00:00.000Z" },
      { url: `${SITE_URL}/docs/whats-new`, lastModified: "2026-10-08T00:00:00.000Z" },
    ])
  })

  it("is empty while the docs experiment is off", async () => {
    queryPublishedDocs.mockResolvedValue([{ slug: "home", updatedAt: "2026-10-01T00:00:00.000Z" }])
    experiment.enabled = false
    expect(await sitemap()).toEqual([])
  })

  it("is empty when there are no docs", async () => {
    queryPublishedDocs.mockResolvedValue([])
    expect(await sitemap()).toEqual([])
  })
})
