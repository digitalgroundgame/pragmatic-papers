// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { queryPublishedDocs } = vi.hoisted(() => ({ queryPublishedDocs: vi.fn() }))
vi.mock("@/plugins/docs/queries", () => ({ queryPublishedDocs }))

import { GET } from "../route"

const SITE_URL = "https://pragmaticpapers.com"

const render = async () => {
  const res = await GET()
  expect(res.headers.get("Content-Type")).toContain("xml")
  return res.text()
}
const entries = (xml: string) =>
  [...xml.matchAll(/<loc>(.*?)<\/loc>\s*<lastmod>(.*?)<\/lastmod>/g)].map(([, loc, lastmod]) => [
    loc,
    lastmod,
  ])

beforeEach(() => vi.stubEnv("SERVER_URL", `${SITE_URL}/`))
afterEach(() => vi.unstubAllEnvs())

describe("GET /docs-sitemap.xml", () => {
  it("lists the /docs index, as fresh as its newest doc, and every doc with a slug", async () => {
    queryPublishedDocs.mockResolvedValue([
      { slug: "experiments", updatedAt: "2026-10-02T00:00:00.000Z" },
      { slug: null, updatedAt: "2026-10-05T00:00:00.000Z" },
      { slug: "unsplash-photos", updatedAt: "2026-10-08T00:00:00.000Z" },
    ])

    expect(entries(await render())).toEqual([
      [`${SITE_URL}/docs`, "2026-10-08T00:00:00.000Z"],
      [`${SITE_URL}/docs/experiments`, "2026-10-02T00:00:00.000Z"],
      [`${SITE_URL}/docs/unsplash-photos`, "2026-10-08T00:00:00.000Z"],
    ])
  })

  it("is empty when there are no docs", async () => {
    queryPublishedDocs.mockResolvedValue([])
    expect(entries(await render())).toEqual([])
  })
})
