import { redditAdapter } from "./reddit.adapter"

describe("RedditAdapter", () => {
  describe("isValidUrl", () => {
    it("returns true for reddit.com post URLs", () => {
      expect(
        redditAdapter.isValidUrl("https://reddit.com/r/subreddit/comments/abc123/post_title"),
      ).toBe(true)
    })

    it("returns true for www.reddit.com post URLs", () => {
      expect(redditAdapter.isValidUrl("https://www.reddit.com/r/sub/comments/abc123/")).toBe(true)
    })

    it("returns true for old.reddit.com post URLs", () => {
      expect(redditAdapter.isValidUrl("https://old.reddit.com/r/sub/comments/abc123/")).toBe(true)
    })

    it("returns true for reddit.com community URLs", () => {
      expect(redditAdapter.isValidUrl("https://reddit.com/r/subreddit")).toBe(true)
    })

    it("returns true for reddit.com community URLs with trailing slash", () => {
      expect(redditAdapter.isValidUrl("https://reddit.com/r/subreddit/")).toBe(true)
    })

    it("returns false for non-reddit domains", () => {
      expect(redditAdapter.isValidUrl("https://example.com/r/sub/comments/123")).toBe(false)
    })

    it("returns false for reddit.com non-post/community URLs", () => {
      expect(redditAdapter.isValidUrl("https://reddit.com/user/someone")).toBe(false)
    })

    it("returns false for invalid URLs", () => {
      expect(redditAdapter.isValidUrl("not a url")).toBe(false)
    })
  })

  describe("buildUrl", () => {
    it("builds correct oEmbed URL", () => {
      const url = redditAdapter.buildUrl({ url: "https://reddit.com/r/sub/comments/123" })
      expect(url.origin).toBe("https://www.reddit.com")
      expect(url.pathname).toBe("/oembed")
    })
  })

  it("has correct displayName", () => {
    expect(redditAdapter.displayName).toBe("Reddit")
  })

  it("has correct maxWidth", () => {
    expect(redditAdapter.maxWidth).toBe(550)
  })
})
