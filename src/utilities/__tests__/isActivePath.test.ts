import { describe, expect, it } from "vitest"
import { isActivePath } from "@/utilities/isActivePath"

describe("isActivePath", () => {
  it("matches the exact route", () => {
    expect(isActivePath("/topics", "/topics")).toBe(true)
  })

  it("keeps a section active on nested routes", () => {
    expect(isActivePath("/topics/ethics", "/topics")).toBe(true)
  })

  it("does not mark sibling routes active", () => {
    expect(isActivePath("/authors", "/topics")).toBe(false)
  })

  it("matches whole segments, not string prefixes", () => {
    expect(isActivePath("/articles-archive", "/articles")).toBe(false)
  })

  it("treats the home route as exact-only", () => {
    expect(isActivePath("/", "/")).toBe(true)
    expect(isActivePath("/topics", "/")).toBe(false)
  })

  it("normalizes trailing slashes", () => {
    expect(isActivePath("/topics", "/topics/")).toBe(true)
  })

  it("ignores the query string and hash", () => {
    expect(isActivePath("/topics", "/topics?sort=new")).toBe(true)
    expect(isActivePath("/about", "/about#team")).toBe(true)
    expect(isActivePath("/", "/?ref=nav")).toBe(true)
  })

  it("ignores external and relative URLs", () => {
    expect(isActivePath("/topics", "https://example.com/topics")).toBe(false)
    expect(isActivePath("/topics", "#topics")).toBe(false)
  })
})
