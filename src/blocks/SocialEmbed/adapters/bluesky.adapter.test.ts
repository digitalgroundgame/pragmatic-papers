import { blueskyAdapter } from "./bluesky.adapter"

describe("BlueskyAdapter", () => {
  describe("isValidUrl", () => {
    it("returns true for bsky.app profile post URLs", () => {
      expect(
        blueskyAdapter.isValidUrl("https://bsky.app/profile/user.bsky.social/post/3kabc123"),
      ).toBe(true)
    })

    it("returns false for non-bsky domains", () => {
      expect(blueskyAdapter.isValidUrl("https://example.com/profile/user/post/123")).toBe(false)
    })

    it("returns false for bsky.app without /profile/ path", () => {
      expect(blueskyAdapter.isValidUrl("https://bsky.app/")).toBe(false)
    })

    it("returns false for bsky.app without /post/ path", () => {
      expect(blueskyAdapter.isValidUrl("https://bsky.app/profile/user.bsky.social")).toBe(false)
    })

    it("returns false for invalid URLs", () => {
      expect(blueskyAdapter.isValidUrl("not a url")).toBe(false)
    })
  })

  describe("buildUrl", () => {
    it("builds correct oEmbed URL", () => {
      const url = blueskyAdapter.buildUrl({ url: "https://bsky.app/profile/user/post/123" })
      expect(url.origin).toBe("https://embed.bsky.app")
      expect(url.pathname).toBe("/oembed")
    })
  })

  it("has correct displayName", () => {
    expect(blueskyAdapter.displayName).toBe("Bluesky")
  })

  it("has correct maxWidth", () => {
    expect(blueskyAdapter.maxWidth).toBe(550)
  })
})
