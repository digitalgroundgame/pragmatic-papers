import { afterEach, describe, expect, it, vi } from "vitest"
import { formatDateTime } from "../formatDateTime"

afterEach(() => {
  vi.useRealTimers()
})

describe("formatDateTime", () => {
  it("formats a timestamp as a readable calendar date", () => {
    expect(formatDateTime("2026-08-23T12:00:00")).toBe("August 23, 2026")
  })

  it("handles single-digit days without zero padding", () => {
    expect(formatDateTime("2026-01-05T12:00:00")).toBe("January 5, 2026")
  })

  it("falls back to the current date when the timestamp is empty", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 14, 12, 0, 0))

    expect(formatDateTime("")).toBe("March 14, 2026")
  })
})
