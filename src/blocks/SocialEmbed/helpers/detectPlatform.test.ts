import { detectPlatform } from "./detectPlatform"

describe("detectPlatform", () => {
  describe("twitter/x", () => {
    it("detects twitter.com", () => {
      expect(detectPlatform("https://twitter.com/user")).toBe("twitter")
    })

    it("detects www.twitter.com", () => {
      expect(detectPlatform("https://www.twitter.com/user")).toBe("twitter")
    })

    it("detects mobile.twitter.com", () => {
      expect(detectPlatform("https://mobile.twitter.com/user")).toBe("twitter")
    })

    it("detects x.com", () => {
      expect(detectPlatform("https://x.com/user")).toBe("twitter")
    })

    it("detects www.x.com", () => {
      expect(detectPlatform("https://www.x.com/user")).toBe("twitter")
    })
  })

  describe("youtube", () => {
    it("detects youtube.com", () => {
      expect(detectPlatform("https://youtube.com/watch?v=123")).toBe("youtube")
    })

    it("detects www.youtube.com", () => {
      expect(detectPlatform("https://www.youtube.com/watch?v=123")).toBe("youtube")
    })

    it("detects m.youtube.com", () => {
      expect(detectPlatform("https://m.youtube.com/watch?v=123")).toBe("youtube")
    })

    it("detects youtu.be short links", () => {
      expect(detectPlatform("https://youtu.be/123")).toBe("youtube")
    })
  })

  describe("bluesky", () => {
    it("detects bsky.app", () => {
      expect(detectPlatform("https://bsky.app/profile/user")).toBe("bluesky")
    })
  })

  describe("reddit", () => {
    it("detects reddit.com", () => {
      expect(detectPlatform("https://reddit.com/r/sub")).toBe("reddit")
    })

    it("detects www.reddit.com", () => {
      expect(detectPlatform("https://www.reddit.com/r/sub")).toBe("reddit")
    })

    it("detects old.reddit.com", () => {
      expect(detectPlatform("https://old.reddit.com/r/sub")).toBe("reddit")
    })

    it("detects np.reddit.com", () => {
      expect(detectPlatform("https://np.reddit.com/r/sub")).toBe("reddit")
    })
  })

  describe("tiktok", () => {
    it("detects tiktok.com", () => {
      expect(detectPlatform("https://tiktok.com/@user")).toBe("tiktok")
    })

    it("detects www.tiktok.com", () => {
      expect(detectPlatform("https://www.tiktok.com/@user")).toBe("tiktok")
    })

    it("detects m.tiktok.com", () => {
      expect(detectPlatform("https://m.tiktok.com/@user")).toBe("tiktok")
    })
  })

  describe("invalid inputs", () => {
    it("returns null for non-social domains", () => {
      expect(detectPlatform("https://example.com")).toBeNull()
    })

    it("returns null for invalid URLs", () => {
      expect(detectPlatform("not a url")).toBeNull()
    })

    it("returns null for empty string", () => {
      expect(detectPlatform("")).toBeNull()
    })

    it("returns null for whitespace only", () => {
      expect(detectPlatform("   ")).toBeNull()
    })

    it("returns null for non-http(s) protocols", () => {
      expect(detectPlatform("ftp://example.com")).toBeNull()
    })

    it("is case-insensitive for hostname", () => {
      expect(detectPlatform("https://TWITTER.COM/user")).toBe("twitter")
    })
  })
})
