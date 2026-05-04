import { twitterAdapter } from "./twitter.adapter"

describe("TwitterAdapter", () => {
  describe("isValidUrl", () => {
    it("returns true for twitter.com status URLs", () => {
      expect(twitterAdapter.isValidUrl("https://twitter.com/username/status/123456789")).toBe(true)
    })

    it("returns false for www.twitter.com (subdomain not accepted)", () => {
      expect(twitterAdapter.isValidUrl("https://www.twitter.com/username/status/123456789")).toBe(
        false,
      )
    })

    it("returns true for x.com status URLs", () => {
      expect(twitterAdapter.isValidUrl("https://x.com/username/status/123456789")).toBe(true)
    })

    it("returns false for non-status twitter URLs", () => {
      expect(twitterAdapter.isValidUrl("https://twitter.com/username")).toBe(false)
    })

    it("returns false for other domains", () => {
      expect(twitterAdapter.isValidUrl("https://example.com/username/status/123")).toBe(false)
    })

    it("returns false for invalid URLs", () => {
      expect(twitterAdapter.isValidUrl("not a url")).toBe(false)
    })
  })

  describe("buildUrl", () => {
    it("builds correct oEmbed URL", () => {
      const url = twitterAdapter.buildUrl({ url: "https://twitter.com/user/status/123" })
      expect(url.origin).toBe("https://publish.twitter.com")
      expect(url.pathname).toBe("/oembed")
      expect(url.searchParams.get("url")).toBe("https://twitter.com/user/status/123")
    })

    it("includes maxwidth parameter", () => {
      const url = twitterAdapter.buildUrl({
        url: "https://twitter.com/user/status/123",
        maxwidth: 500,
      })
      expect(url.searchParams.get("maxwidth")).toBe("500")
    })

    it("includes theme parameter", () => {
      const url = twitterAdapter.buildUrl({
        url: "https://twitter.com/user/status/123",
        theme: "dark",
      })
      expect(url.searchParams.get("theme")).toBe("dark")
    })

    it("sets default hide_thread to true", () => {
      const url = twitterAdapter.buildUrl({ url: "https://twitter.com/user/status/123" })
      expect(url.searchParams.get("hide_thread")).toBe("true")
    })
  })

  it("has correct displayName", () => {
    expect(twitterAdapter.displayName).toBe("Twitter")
  })

  it("has correct maxWidth", () => {
    expect(twitterAdapter.maxWidth).toBe(550)
  })
})
