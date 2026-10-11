// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { getNewsSitemap } from "../../articles/news-sitemap.xml/getNewsSitemap"
import { GET as sitemapIndex } from "../sitemap_index.xml/route"

vi.mock("../../articles/news-sitemap.xml/getNewsSitemap", () => ({ getNewsSitemap: vi.fn() }))

const NEWS_ENTRY = {
  loc: "http://localhost:8000/articles/the-case-for-reform",
  lastmod: "2026-09-01T12:00:00.000Z",
  news: {
    title: "The Case for Reform",
    publicationName: "The Pragmatic Papers",
    publicationLanguage: "en",
    date: "2026-08-30T09:00:00.000Z",
  },
}

const locs = (xml: string) => [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(([, loc]) => loc)

beforeEach(() => {
  vi.stubEnv("SERVER_URL", "http://localhost:8000")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// Rendered per request, so it names SERVER_URL's host as the server has it, and lists the news
// sitemap only while it has articles.
describe("GET /sitemap_index.xml", () => {
  it("indexes each sitemap route on SERVER_URL's host", async () => {
    vi.mocked(getNewsSitemap).mockResolvedValue([NEWS_ENTRY])
    const res = await sitemapIndex()

    expect(res.headers.get("Content-Type")).toContain("xml")
    const xml = await res.text()
    expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(locs(xml)).toEqual([
      "http://localhost:8000/sitemap.xml",
      "http://localhost:8000/articles/sitemap.xml",
      "http://localhost:8000/articles/news-sitemap.xml",
      "http://localhost:8000/volumes/sitemap.xml",
      "http://localhost:8000/contributors/sitemap.xml",
      "http://localhost:8000/topics/sitemap.xml",
      "http://localhost:8000/docs/sitemap.xml",
    ])
  })

  it("leaves the news sitemap out while no article is in its window", async () => {
    vi.mocked(getNewsSitemap).mockResolvedValue([])

    const xml = await (await sitemapIndex()).text()

    expect(locs(xml)).not.toContain("http://localhost:8000/articles/news-sitemap.xml")
    expect(locs(xml)).toContain("http://localhost:8000/articles/sitemap.xml")
  })
})
