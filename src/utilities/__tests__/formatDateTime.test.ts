import { afterEach, describe, expect, it, vi } from "vitest"
import { formatDateTime } from "../formatDateTime"

afterEach(() => {
  vi.useRealTimers()
})

describe("formatDateTime", () => {
  it("formats an ISO timestamp as a readable calendar date", () => {
    expect(formatDateTime("2026-08-23T10:30:00.000Z")).toBe("August 23, 2026")
  })

  it("handles single-digit days without zero padding", () => {
    expect(formatDateTime("2026-01-05T12:00:00.000Z")).toBe("January 5, 2026")
  })

  it("falls back to the current date when the timestamp is empty", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-14T12:00:00.000Z"))

    expect(formatDateTime("")).toBe("March 14, 2026")
  })
})
