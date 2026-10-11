// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"

import { getNewsSitemap } from "../(frontend)/articles/news-sitemap.xml/getNewsSitemap"
import robots from "../robots"

vi.mock("../(frontend)/articles/news-sitemap.xml/getNewsSitemap", () => ({
  getNewsSitemap: vi.fn(),
}))

const NEWS_ENTRY = {
  loc: "https://pragmaticpapers.com/articles/the-case-for-reform",
  lastmod: "2026-09-01T12:00:00.000Z",
  news: {
    title: "The Case for Reform",
    publicationName: "The Pragmatic Papers",
    publicationLanguage: "en",
    date: "2026-08-30T09:00:00.000Z",
  },
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("robots.txt", () => {
  it("names the host from SERVER_URL as it is when rendered", async () => {
    vi.mocked(getNewsSitemap).mockResolvedValue([NEWS_ENTRY])
    vi.stubEnv("SERVER_URL", "https://pr-1.pragmaticpapers.com")
    await robots()
    vi.stubEnv("SERVER_URL", "https://pragmaticpapers.com")

    expect(await robots()).toEqual({
      rules: { userAgent: "*", disallow: "/admin/*" },
      host: "https://pragmaticpapers.com",
      sitemap: [
        "https://pragmaticpapers.com/sitemap_index.xml",
        "https://pragmaticpapers.com/sitemap.xml",
        "https://pragmaticpapers.com/articles/sitemap.xml",
        "https://pragmaticpapers.com/articles/news-sitemap.xml",
        "https://pragmaticpapers.com/volumes/sitemap.xml",
        "https://pragmaticpapers.com/contributors/sitemap.xml",
        "https://pragmaticpapers.com/topics/sitemap.xml",
        "https://pragmaticpapers.com/docs/sitemap.xml",
      ],
    })
  })

  it("leaves the news sitemap out while no article is in its window", async () => {
    vi.mocked(getNewsSitemap).mockResolvedValue([])
    vi.stubEnv("SERVER_URL", "https://pragmaticpapers.com")

    expect((await robots()).sitemap).not.toContain(
      "https://pragmaticpapers.com/articles/news-sitemap.xml",
    )
  })

  it("lists every sitemap when the news sitemap can't be read", async () => {
    vi.mocked(getNewsSitemap).mockRejectedValue(new Error("cannot connect to Postgres"))
    vi.stubEnv("SERVER_URL", "https://pragmaticpapers.com")

    expect((await robots()).sitemap).toContain(
      "https://pragmaticpapers.com/articles/news-sitemap.xml",
    )
  })
})
