import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { getMediaUrl } from "../getMediaUrl"

describe("getMediaUrl", () => {
  const originalEnv = process.env.NEXT_PUBLIC_SERVER_URL

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SERVER_URL = "http://localhost:8000"
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_SERVER_URL = originalEnv
  })

  it("returns empty string if URL is not provided", () => {
    expect(getMediaUrl(undefined)).toBe("")
    expect(getMediaUrl(null)).toBe("")
    expect(getMediaUrl("")).toBe("")
  })

  it("keeps relative URLs relative and unencoded by default", () => {
    expect(getMediaUrl("/media/hello.png")).toBe("/media/hello.png")
    expect(getMediaUrl("/media/hello world.png")).toBe("/media/hello world.png")
    expect(getMediaUrl("/media/hello world (1).png")).toBe("/media/hello world (1).png")
  })

  it("keeps absolute URLs absolute and unencoded by default", () => {
    expect(getMediaUrl("https://s3.amazonaws.com/bucket/hello world.png")).toBe(
      "https://s3.amazonaws.com/bucket/hello world.png",
    )
  })

  it("appends cache tag to absolute URLs when cache tag is passed as a string", () => {
    expect(getMediaUrl("https://s3.amazonaws.com/bucket/hello.png", "v123")).toBe(
      "https://s3.amazonaws.com/bucket/hello.png?v123",
    )
    // Should preserve existing query params safely
    expect(getMediaUrl("https://s3.amazonaws.com/bucket/hello.png?param=1", "v123")).toBe(
      "https://s3.amazonaws.com/bucket/hello.png?param=1&v123",
    )
  })

  it("appends cache tag via the options object", () => {
    expect(getMediaUrl("https://s3.amazonaws.com/bucket/hello.png", { cacheTag: "v123" })).toBe(
      "https://s3.amazonaws.com/bucket/hello.png?v123",
    )
  })

  it("converts relative URL to absolute URL and percent-encodes when absolute option is true", () => {
    expect(getMediaUrl("/media/hello.png", { absolute: true })).toBe(
      "http://localhost:8000/media/hello.png",
    )
    expect(getMediaUrl("media/hello world.png", { absolute: true })).toBe(
      "http://localhost:8000/media/hello%20world.png",
    )
  })

  it("percent-encodes when encode option is explicitly true", () => {
    expect(getMediaUrl("/media/hello world.png", { encode: true })).toBe("/media/hello%20world.png")
    expect(getMediaUrl("https://s3.amazonaws.com/bucket/hello world.png", { encode: true })).toBe(
      "https://s3.amazonaws.com/bucket/hello%20world.png",
    )
  })

  it("does not percent-encode when encode option is explicitly false even if absolute is true", () => {
    expect(getMediaUrl("/media/hello world.png", { absolute: true, encode: false })).toBe(
      "http://localhost:8000/media/hello world.png",
    )
  })

  it("handles trailing and leading slashes correctly when creating absolute URLs", () => {
    process.env.NEXT_PUBLIC_SERVER_URL = "http://localhost:8000/"
    expect(getMediaUrl("/media/hello.png", { absolute: true })).toBe(
      "http://localhost:8000/media/hello.png",
    )

    process.env.NEXT_PUBLIC_SERVER_URL = "http://localhost:8000"
    expect(getMediaUrl("media/hello.png", { absolute: true })).toBe(
      "http://localhost:8000/media/hello.png",
    )
  })

  it("does not alter already absolute URLs when absolute is true", () => {
    expect(getMediaUrl("https://other-domain.com/hello world.png", { absolute: true })).toBe(
      "https://other-domain.com/hello%20world.png",
    )
  })

  it("handles non-ASCII unicode characters correctly when encode is true", () => {
    expect(getMediaUrl("/media/изображение.png", { encode: true })).toBe(
      "/media/%D0%B8%D0%B7%D0%BE%D0%B1%D1%80%D0%B0%D0%B6%D0%B5%D0%BD%D0%B8%D0%B5.png",
    )
  })
})
