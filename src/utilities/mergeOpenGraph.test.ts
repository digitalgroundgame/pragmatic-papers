import { describe, it, expect, vi } from "vitest"
import { mergeOpenGraph } from "./mergeOpenGraph"

vi.mock("./getURL", () => ({
  getServerSideURL: () => "http://localhost:3000",
}))

describe("mergeOpenGraph", () => {
  it("returns default OpenGraph when no input provided", () => {
    const result = mergeOpenGraph()
    expect(result?.siteName).toBe("The Pragmatic Papers")
    expect(result?.title).toBe("The Pragmatic Papers")
  })

  it("overrides title when provided", () => {
    const result = mergeOpenGraph({ title: "Custom Title" })
    expect(result?.title).toBe("Custom Title")
    expect(result?.siteName).toBe("The Pragmatic Papers")
  })

  it("overrides description when provided", () => {
    const result = mergeOpenGraph({ description: "Custom description" })
    expect(result?.description).toBe("Custom description")
  })

  it("uses custom images when provided", () => {
    const customImages = [{ url: "https://example.com/image.jpg", alt: "Custom" }]
    const result = mergeOpenGraph({ images: customImages })
    expect(result?.images).toEqual(customImages)
  })

  it("uses default images when not provided", () => {
    const result = mergeOpenGraph()
    expect(result?.images).toEqual([
      {
        url: "http://localhost:3000/the-pragmatic-papers-opengraph-image.png",
        alt: expect.any(String),
      },
    ])
  })
})
