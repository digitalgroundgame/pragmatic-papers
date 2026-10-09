// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"

import { GET as robots } from "../robots.txt/route"
import { GET as sitemapIndex } from "../sitemap.xml/route"

afterEach(() => {
  vi.unstubAllEnvs()
})

// Both are routes rather than files written at build time, so they render with whatever
// SERVER_URL the server has when they're (re)rendered, and revalidate-all can point an
// image at the host it serves.
describe("GET /robots.txt", () => {
  it("names the host from SERVER_URL as it is when rendered", async () => {
    vi.stubEnv("SERVER_URL", "https://pr-1.pragmaticpapers.com")
    await robots()
    vi.stubEnv("SERVER_URL", "https://pragmaticpapers.com")
    const res = await robots()

    expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8")
    expect(await res.text()).toBe(
      [
        "# *",
        "User-agent: *",
        "Disallow: /admin/*",
        "",
        "# Host",
        "Host: https://pragmaticpapers.com",
        "",
        "# Sitemaps",
        "Sitemap: https://pragmaticpapers.com/sitemap.xml",
        "Sitemap: https://pragmaticpapers.com/pages/sitemap.xml",
        "Sitemap: https://pragmaticpapers.com/articles/sitemap.xml",
        "Sitemap: https://pragmaticpapers.com/articles/news-sitemap.xml",
        "Sitemap: https://pragmaticpapers.com/volumes/sitemap.xml",
        "Sitemap: https://pragmaticpapers.com/interactives/sitemap.xml",
        "Sitemap: https://pragmaticpapers.com/authors/sitemap.xml",
        "Sitemap: https://pragmaticpapers.com/topics/sitemap.xml",
        "Sitemap: https://pragmaticpapers.com/docs/sitemap.xml",
        "",
      ].join("\n"),
    )
  })
})

describe("GET /sitemap.xml", () => {
  it("indexes each sitemap route on SERVER_URL's host", async () => {
    vi.stubEnv("SERVER_URL", "http://localhost:8000")
    const res = await sitemapIndex()

    expect(res.headers.get("Content-Type")).toContain("xml")
    const xml = await res.text()
    expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect([...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(([, loc]) => loc)).toEqual([
      "http://localhost:8000/pages/sitemap.xml",
      "http://localhost:8000/articles/sitemap.xml",
      "http://localhost:8000/articles/news-sitemap.xml",
      "http://localhost:8000/volumes/sitemap.xml",
      "http://localhost:8000/interactives/sitemap.xml",
      "http://localhost:8000/authors/sitemap.xml",
      "http://localhost:8000/topics/sitemap.xml",
      "http://localhost:8000/docs/sitemap.xml",
    ])
  })
})
