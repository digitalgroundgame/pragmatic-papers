import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { formatLongDate, formatTimeAgo } from "@/utilities/formatDate"

// formatTimeAgo is measured against the clock, so it has to stand still.
beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date("2024-06-20T12:00:00.000Z"))
})

afterAll(() => {
  vi.useRealTimers()
})

describe("formatLongDate", () => {
  it("spells the month out", () => {
    expect(formatLongDate("2024-06-15T12:00:00.000Z")).toBe("June 15, 2024")
  })

  it("abbreviates it when asked", () => {
    expect(formatLongDate("2024-06-15T12:00:00.000Z", { month: "short" })).toBe("Jun 15, 2024")
  })

  it("takes a Date", () => {
    expect(formatLongDate(new Date("2024-06-15T12:00:00.000Z"))).toBe("June 15, 2024")
  })

  // The suite runs in UTC (vitest.config.mts), so the zone is pinned in the call itself.
  it("reads the date in UTC rather than the reader's zone", () => {
    vi.stubEnv("TZ", "America/Los_Angeles")
    expect(formatLongDate("2024-01-01T00:00:00.000Z")).toBe("January 1, 2024")
    vi.unstubAllEnvs()
  })

  it.each([null, undefined, "", "not a date"])("is empty for %j", (value) => {
    expect(formatLongDate(value)).toBe("")
  })
})

describe("formatTimeAgo", () => {
  it.each([
    ["2024-06-20T11:59:50.000Z", "just now"],
    ["2024-06-20T11:57:00.000Z", "3 minutes ago"],
    ["2024-06-20T11:10:00.000Z", "1 hour ago"],
    ["2024-06-20T09:00:00.000Z", "3 hours ago"],
    ["2024-06-19T10:00:00.000Z", "yesterday"],
    ["2024-06-15T12:00:00.000Z", "5 days ago"],
    ["2024-05-22T12:00:00.000Z", "last month"],
    ["2024-03-20T12:00:00.000Z", "3 months ago"],
    ["2023-08-01T12:00:00.000Z", "last year"],
    ["2021-06-20T12:00:00.000Z", "3 years ago"],
    ["2024-06-22T12:00:00.000Z", "in 2 days"],
  ])("phrases %s as %j", (timestamp, expected) => {
    expect(formatTimeAgo(timestamp)).toBe(expected)
  })
})
