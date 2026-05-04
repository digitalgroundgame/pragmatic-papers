import { describe, it, expect, vi } from "vitest"
import { getMediaUrl } from "./getMediaUrl"

vi.mock("@/utilities/getURL", () => ({
  getClientSideURL: () => "http://localhost:3000",
}))

describe("getMediaUrl", () => {
  it("returns empty string for null", () => {
    expect(getMediaUrl(null)).toBe("")
  })

  it("returns empty string for undefined", () => {
    expect(getMediaUrl(undefined)).toBe("")
  })

  it("returns URL as-is when it starts with http://", () => {
    expect(getMediaUrl("http://example.com/image.jpg")).toBe("http://example.com/image.jpg")
  })

  it("returns URL as-is when it starts with https://", () => {
    expect(getMediaUrl("https://example.com/image.jpg")).toBe("https://example.com/image.jpg")
  })

  it("prepends client-side URL for relative paths", () => {
    expect(getMediaUrl("/media/image.jpg")).toBe("http://localhost:3000/media/image.jpg")
  })

  it("appends cacheTag when provided", () => {
    expect(getMediaUrl("/media/image.jpg", "cache123")).toBe(
      "http://localhost:3000/media/image.jpg?cache123",
    )
  })

  it("appends cacheTag to absolute URLs", () => {
    expect(getMediaUrl("https://example.com/image.jpg", "cache123")).toBe(
      "https://example.com/image.jpg?cache123",
    )
  })
})
