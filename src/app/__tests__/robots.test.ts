// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"

import robots from "../robots"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("robots.txt", () => {
  it("names the host from SERVER_URL as it is when rendered", () => {
    vi.stubEnv("SERVER_URL", "https://pr-1.pragmaticpapers.com")
    robots()
    vi.stubEnv("SERVER_URL", "https://pragmaticpapers.com")

    expect(robots()).toEqual({
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
      ],
    })
  })
})
