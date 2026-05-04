import { tiktokAdapter, parseTikTokPostId, buildTikTokSrc } from "./tiktok.adapter"

describe("parseTikTokPostId", () => {
  it("extracts ID from tiktok.com/video/ URL", () => {
    expect(parseTikTokPostId("https://tiktok.com/@user/video/7123456789")).toBe("7123456789")
  })

  it("extracts ID from www.tiktok.com/video/ URL", () => {
    expect(parseTikTokPostId("https://www.tiktok.com/@user/video/7123456789")).toBe("7123456789")
  })

  it("extracts ID from m.tiktok.com/video/ URL", () => {
    expect(parseTikTokPostId("https://m.tiktok.com/@user/video/7123456789")).toBe("7123456789")
  })

  it("returns null for non-TikTok domains", () => {
    expect(parseTikTokPostId("https://example.com/@user/video/123")).toBeNull()
  })

  it("returns null for invalid URLs", () => {
    expect(parseTikTokPostId("not a url")).toBeNull()
  })

  it("returns null for TikTok URL without /video/ path", () => {
    expect(parseTikTokPostId("https://tiktok.com/@user")).toBeNull()
  })
})

describe("buildTikTokSrc", () => {
  it("builds embed URL with post ID", () => {
    const src = buildTikTokSrc("7123456789")
    expect(src).toContain("https://www.tiktok.com/player/v1/7123456789")
  })

  it("includes default control parameters", () => {
    const src = buildTikTokSrc("7123456789")
    expect(src).toContain("controls=1")
    expect(src).toContain("progress_bar=1")
  })

  it("respects custom settings", () => {
    const src = buildTikTokSrc("7123456789", { autoplay: 1, loop: 1 })
    expect(src).toContain("autoplay=1")
    expect(src).toContain("loop=1")
  })
})

describe("TikTokAdapter", () => {
  describe("isValidUrl", () => {
    it("returns true for valid TikTok URLs", () => {
      expect(tiktokAdapter.isValidUrl("https://tiktok.com/@user/video/7123456789")).toBe(true)
    })

    it("returns false for invalid URLs", () => {
      expect(tiktokAdapter.isValidUrl("https://example.com")).toBe(false)
    })
  })

  it("has correct displayName", () => {
    expect(tiktokAdapter.displayName).toBe("TikTok")
  })

  it("has correct maxWidth", () => {
    expect(tiktokAdapter.maxWidth).toBe(360)
  })
})
