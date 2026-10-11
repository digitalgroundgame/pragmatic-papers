// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"

import { GET as sitemapIndex } from "../sitemap_index.xml/route"

afterEach(() => {
  vi.unstubAllEnvs()
})

// A route rather than a file written at build time, so it renders with whatever SERVER_URL
// the server has when it is (re)rendered, and revalidate-all can point an image at the host
// it serves.
describe("GET /sitemap_index.xml", () => {
  it("indexes each sitemap route on SERVER_URL's host", async () => {
    vi.stubEnv("SERVER_URL", "http://localhost:8000")
    const res = await sitemapIndex()

    expect(res.headers.get("Content-Type")).toContain("xml")
    const xml = await res.text()
    expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect([...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(([, loc]) => loc)).toEqual([
      "http://localhost:8000/sitemap.xml",
      "http://localhost:8000/articles/sitemap.xml",
      "http://localhost:8000/articles/news-sitemap.xml",
      "http://localhost:8000/volumes/sitemap.xml",
      "http://localhost:8000/contributors/sitemap.xml",
      "http://localhost:8000/topics/sitemap.xml",
    ])
  })
})
