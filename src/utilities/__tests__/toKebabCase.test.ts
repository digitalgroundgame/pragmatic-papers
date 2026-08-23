import { describe, expect, it } from "vitest"
import { toKebabCase } from "../toKebabCase"

describe("toKebabCase", () => {
  it("converts camelCase to kebab-case", () => {
    expect(toKebabCase("heroImageAlt")).toBe("hero-image-alt")
  })

  it("converts whitespace-separated words", () => {
    expect(toKebabCase("Featured Article Title")).toBe("featured-article-title")
  })

  it("handles mixed camelCase and whitespace", () => {
    expect(toKebabCase("articleHero FeaturedImage")).toBe("article-hero-featured-image")
  })

  it("collapses consecutive whitespace into one separator", () => {
    expect(toKebabCase("one   two\tthree")).toBe("one-two-three")
  })

  it("returns an empty string for empty input", () => {
    expect(toKebabCase("")).toBe("")
  })
})
