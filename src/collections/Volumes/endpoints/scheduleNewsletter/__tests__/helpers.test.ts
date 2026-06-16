import { afterEach, describe, expect, it } from "vitest"

import {
  articleTag,
  buildEnv,
  campaignName,
  newsletterTag,
  nextWeekday7amET,
  parseArticleIdFromTag,
  sevenAmEtAsUtc,
  volumeTag,
} from "../helpers"

describe("sevenAmEtAsUtc", () => {
  it("returns 12:00 UTC in standard time (EST = UTC-5)", () => {
    // Jan 15 is well within standard time
    const d = sevenAmEtAsUtc(2026, 0, 15)
    expect(d.getUTCHours()).toBe(12)
    expect(d.getUTCMinutes()).toBe(0)
  })

  it("returns 11:00 UTC in daylight time (EDT = UTC-4)", () => {
    // Jul 15 is well within daylight saving time
    const d = sevenAmEtAsUtc(2026, 6, 15)
    expect(d.getUTCHours()).toBe(11)
    expect(d.getUTCMinutes()).toBe(0)
  })
})

describe("nextWeekday7amET", () => {
  // Use 20:00 UTC (3pm EST / 4pm EDT) to ensure we're unambiguously on the right NY calendar date.

  it("advances Monday to Tuesday", () => {
    // Jan 5, 2026 = Monday (EST)
    const result = nextWeekday7amET(new Date("2026-01-05T20:00:00Z"))
    expect(result.toISOString()).toBe("2026-01-06T12:00:00.000Z")
  })

  it("advances Friday to the following Monday (skips Sat + Sun)", () => {
    // Jan 9, 2026 = Friday (EST)
    const result = nextWeekday7amET(new Date("2026-01-09T20:00:00Z"))
    expect(result.toISOString()).toBe("2026-01-12T12:00:00.000Z")
  })

  it("advances Saturday to Monday", () => {
    // Jan 10, 2026 = Saturday (EST)
    const result = nextWeekday7amET(new Date("2026-01-10T20:00:00Z"))
    expect(result.toISOString()).toBe("2026-01-12T12:00:00.000Z")
  })

  it("advances Sunday to Monday", () => {
    // Jan 11, 2026 = Sunday (EST)
    const result = nextWeekday7amET(new Date("2026-01-11T20:00:00Z"))
    expect(result.toISOString()).toBe("2026-01-12T12:00:00.000Z")
  })

  it("handles the DST spring-forward boundary (Mar 6 → Mar 9, 2026)", () => {
    // Mar 6, 2026 = Friday; clocks spring forward Mar 8. Mar 9 = Monday in EDT (UTC-4).
    const result = nextWeekday7amET(new Date("2026-03-06T20:00:00Z"))
    expect(result.toISOString()).toBe("2026-03-09T11:00:00.000Z")
  })
})

describe("campaignName", () => {
  it("formats as 'Volume N · Day K of Total · title' with 1-based day index", () => {
    expect(campaignName(3, 0, 5, "My Article", "production")).toBe(
      "Volume 3 · Day 1 of 5 · My Article",
    )
    expect(campaignName(1, 4, 5, "Last One", "production")).toBe("Volume 1 · Day 5 of 5 · Last One")
  })

  it("has no environment prefix in production", () => {
    expect(campaignName(3, 0, 5, "My Article", "production")).not.toContain("[")
  })

  it("prefixes non-production environments so they stay distinct in the shared admin", () => {
    expect(campaignName(3, 0, 5, "My Article", "staging")).toBe(
      "[staging] Volume 3 · Day 1 of 5 · My Article",
    )
    expect(campaignName(3, 0, 5, "My Article", "dev")).toBe(
      "[dev] Volume 3 · Day 1 of 5 · My Article",
    )
  })
})

describe("buildEnv", () => {
  const original = process.env.BUILD_ENV
  afterEach(() => {
    if (original === undefined) delete process.env.BUILD_ENV
    else process.env.BUILD_ENV = original
  })

  it("returns 'production' / 'staging' when BUILD_ENV matches", () => {
    process.env.BUILD_ENV = "production"
    expect(buildEnv()).toBe("production")
    process.env.BUILD_ENV = "staging"
    expect(buildEnv()).toBe("staging")
  })

  it("falls back to 'dev' when BUILD_ENV is unset or unrecognized", () => {
    delete process.env.BUILD_ENV
    expect(buildEnv()).toBe("dev")
    process.env.BUILD_ENV = "preview"
    expect(buildEnv()).toBe("dev")
  })
})

describe("newsletterTag", () => {
  it("is the bare 'newsletter' tag in production", () => {
    expect(newsletterTag("production")).toBe("newsletter")
  })

  it("is namespaced per environment elsewhere", () => {
    expect(newsletterTag("staging")).toBe("newsletter-staging")
    expect(newsletterTag("dev")).toBe("newsletter-dev")
  })
})

describe("volumeTag", () => {
  it("formats as vol-N", () => {
    expect(volumeTag(12)).toBe("vol-12")
    expect(volumeTag(1)).toBe("vol-1")
  })
})

describe("articleTag", () => {
  it("formats as art-N", () => {
    expect(articleTag(5)).toBe("art-5")
    expect(articleTag(0)).toBe("art-0")
  })
})

describe("parseArticleIdFromTag", () => {
  it("parses a valid art tag", () => {
    expect(parseArticleIdFromTag("art-5")).toBe(5)
    expect(parseArticleIdFromTag("art-123")).toBe(123)
  })

  it("returns null for a non-numeric suffix", () => {
    expect(parseArticleIdFromTag("art-abc")).toBeNull()
  })

  it("returns null for a vol tag", () => {
    expect(parseArticleIdFromTag("vol-5")).toBeNull()
  })

  it("returns null for art- with no digits", () => {
    expect(parseArticleIdFromTag("art-")).toBeNull()
  })

  it("returns null for the newsletter tag", () => {
    expect(parseArticleIdFromTag("newsletter")).toBeNull()
  })
})
