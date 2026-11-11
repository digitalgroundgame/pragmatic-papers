import { describe, expect, it } from "vitest"

import {
  cleanSubstackUrl,
  isSubstackUrl,
  substackPostUrl,
  validateSubstackUrl,
} from "../substackUrl"

const validate = (value: string | null | undefined) => validateSubstackUrl(value, {} as never)

describe("isSubstackUrl", () => {
  it.each([
    "https://thepragmaticpapers.substack.com/p/an-article",
    "https://substack.com/@thepragmaticpapers/p-123456",
    "https://substack.com/home/post/p-123456",
    "https://open.substack.com/pub/thepragmaticpapers/p/an-article",
    "https://THEPRAGMATICPAPERS.SUBSTACK.COM/p/an-article",
  ])("accepts %s", (url) => {
    expect(isSubstackUrl(url)).toBe(true)
  })

  it.each([
    ["plain http", "http://thepragmaticpapers.substack.com/p/an-article"],
    ["our own site", "https://pragmaticpapers.com/articles/an-article"],
    ["a lookalike host", "https://notsubstack.com/p/an-article"],
    ["Substack as a subdomain of another host", "https://substack.com.example.org/p/an-article"],
    ["a script", "javascript:alert(1)"],
    ["no scheme", "thepragmaticpapers.substack.com/p/an-article"],
    ["not a URL", "imported"],
  ])("rejects %s", (_label, url) => {
    expect(isSubstackUrl(url)).toBe(false)
  })
})

describe("validateSubstackUrl", () => {
  it.each([undefined, null, "", "   "])("allows an empty value (%j)", (value) => {
    expect(validate(value)).toBe(true)
  })

  it("allows a Substack address, spaces around it included", () => {
    expect(validate("  https://thepragmaticpapers.substack.com/p/an-article ")).toBe(true)
  })

  it("explains what to paste otherwise", () => {
    expect(validate("https://pragmaticpapers.com/articles/an-article")).toEqual(
      expect.stringContaining("https://"),
    )
  })
})

describe("cleanSubstackUrl", () => {
  it("trims the address", () => {
    expect(cleanSubstackUrl(" https://substack.com/home/post/p-1 ")).toBe(
      "https://substack.com/home/post/p-1",
    )
  })

  it.each([undefined, null, "", "  "])("turns an empty value (%j) into null", (value) => {
    expect(cleanSubstackUrl(value)).toBeNull()
  })
})

describe("substackPostUrl", () => {
  const substackUrl = "https://thepragmaticpapers.substack.com/p/an-article"

  it("is the recorded address while the article is syndicated", () => {
    expect(substackPostUrl({ syndicateToSubstack: true, substackUrl })).toBe(substackUrl)
  })

  it.each([
    ["the article isn't syndicated", { syndicateToSubstack: false, substackUrl }],
    ["nothing is recorded", { syndicateToSubstack: true, substackUrl: null }],
    [
      "the address isn't on Substack",
      { syndicateToSubstack: true, substackUrl: "https://example.org/p/an-article" },
    ],
  ])("is null when %s", (_label, article) => {
    expect(substackPostUrl(article)).toBeNull()
  })
})
