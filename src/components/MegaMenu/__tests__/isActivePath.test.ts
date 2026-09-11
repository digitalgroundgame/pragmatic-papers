import { describe, expect, it } from "vitest"
import { isActivePath } from "../isActivePath"

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

  it("treats the home route as exact-only", () => {
    expect(isActivePath("/", "/")).toBe(true)
    expect(isActivePath("/topics", "/")).toBe(false)
  })

  it("normalizes trailing slashes", () => {
    expect(isActivePath("/topics", "/topics/")).toBe(true)
  })

  it("ignores external and missing URLs", () => {
    expect(isActivePath("/topics", "https://example.com/topics")).toBe(false)
    expect(isActivePath("/topics", null)).toBe(false)
  })
})
