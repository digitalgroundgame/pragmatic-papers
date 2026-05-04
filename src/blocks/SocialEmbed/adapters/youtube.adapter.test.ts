import { parseYouTubeVideoId, youtubeAdapter } from "./youtube.adapter"

describe("parseYouTubeVideoId", () => {
  it("extracts ID from youtube.com/watch?v= URL", () => {
    expect(parseYouTubeVideoId("https://youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
  })

  it("extracts ID from www.youtube.com/watch?v= URL", () => {
    expect(parseYouTubeVideoId("https://www.youtube.com/watch?v=abc123")).toBe("abc123")
  })

  it("extracts ID from youtu.be short URL", () => {
    expect(parseYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
  })

  it("extracts ID from youtube.com/embed/ URL", () => {
    expect(parseYouTubeVideoId("https://youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
  })

  it("extracts ID from youtube.com/v/ URL", () => {
    expect(parseYouTubeVideoId("https://youtube.com/v/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
  })

  it("returns null for non-YouTube URLs", () => {
    expect(parseYouTubeVideoId("https://example.com/watch?v=123")).toBeNull()
  })

  it("returns null for invalid URLs", () => {
    expect(parseYouTubeVideoId("not a url")).toBeNull()
  })

  it("returns null for empty string", () => {
    expect(parseYouTubeVideoId("")).toBeNull()
  })

  it("handles URLs with additional path after video ID", () => {
    expect(parseYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ?t=30")).toBe("dQw4w9WgXcQ")
  })
})

describe("YouTubeAdapter", () => {
  describe("isValidUrl", () => {
    it("returns true for valid YouTube URLs", () => {
      expect(youtubeAdapter.isValidUrl("https://youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true)
    })

    it("returns false for invalid URLs", () => {
      expect(youtubeAdapter.isValidUrl("https://example.com")).toBe(false)
    })
  })

  describe("buildUrl", () => {
    it("builds correct oEmbed URL", () => {
      const url = youtubeAdapter.buildUrl({ url: "https://youtube.com/watch?v=123" })
      expect(url.origin).toBe("https://www.youtube.com")
      expect(url.pathname).toBe("/oembed")
      expect(url.searchParams.get("url")).toBe("https://youtube.com/watch?v=123")
      expect(url.searchParams.get("format")).toBe("json")
    })

    it("includes maxwidth parameter", () => {
      const url = youtubeAdapter.buildUrl({ url: "https://youtube.com/watch?v=123", maxwidth: 800 })
      expect(url.searchParams.get("maxwidth")).toBe("800")
    })
  })

  it("has correct displayName", () => {
    expect(youtubeAdapter.displayName).toBe("YouTube")
  })

  it("has correct maxWidth", () => {
    expect(youtubeAdapter.maxWidth).toBe(640)
  })
})
