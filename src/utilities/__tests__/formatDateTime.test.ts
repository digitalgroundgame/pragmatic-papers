import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { formatDateTime, formatTimeAgo } from "../formatDateTime"

// Both helpers can read the clock, and the suite pins TZ=UTC (vitest.config.mts).
const NOW = "2024-06-20T12:00:00.000Z"

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(NOW))
})

afterAll(() => {
  vi.useRealTimers()
})

describe("formatDateTime", () => {
  it("spells the month out", () => {
    expect(formatDateTime("2024-06-15T12:00:00.000Z")).toBe("June 15, 2024")
  })

  it("reads the date in UTC rather than shifting it", () => {
    expect(formatDateTime("2024-01-01T00:00:00.000Z")).toBe("January 1, 2024")
  })

  it("falls back to today when handed an empty timestamp", () => {
    expect(formatDateTime("")).toBe("June 20, 2024")
  })
})

describe("formatTimeAgo", () => {
  it("phrases a past date as a distance", () => {
    expect(formatTimeAgo("2024-06-15T12:00:00.000Z")).toBe("5 days ago")
  })

  it("phrases a future date the other way round", () => {
    expect(formatTimeAgo("2024-06-22T12:00:00.000Z")).toBe("in 2 days")
  })

  it("rounds a near-simultaneous timestamp to the smallest unit", () => {
    expect(formatTimeAgo("2024-06-20T11:59:50.000Z")).toBe("less than a minute ago")
  })
})
