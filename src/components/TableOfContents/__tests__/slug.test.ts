import { describe, expect, it } from "vitest"

import { slugifyHeading } from "../slug"

describe("slugifyHeading", () => {
  it("lowercases and trims", () => {
    expect(slugifyHeading("  Hello World  ")).toBe("hello-world")
  })

  it("replaces non-alphanumeric runs with a dash", () => {
    expect(slugifyHeading("Foo & Bar!")).toBe("foo-bar")
  })

  it("strips leading and trailing dashes", () => {
    expect(slugifyHeading("!hello!")).toBe("hello")
  })

  it("collapses multiple separators into one dash", () => {
    expect(slugifyHeading("a   ---   b")).toBe("a-b")
  })

  it("handles an empty string", () => {
    expect(slugifyHeading("")).toBe("")
  })

  it("preserves numbers", () => {
    expect(slugifyHeading("Section 42")).toBe("section-42")
  })
})
