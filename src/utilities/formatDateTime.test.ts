import { describe, it, expect } from "vitest"
import { formatDateTime } from "./formatDateTime"

describe("formatDateTime", () => {
  it("formats a valid timestamp", () => {
    // January 15, 2024
    const result = formatDateTime("2024-01-15T10:30:00Z")
    expect(result).toBe("January 15, 2024")
  })

  it("handles different dates (noon UTC to avoid tz shift)", () => {
    const result = formatDateTime("2023-12-25T12:00:00Z")
    expect(result).toBe("December 25, 2023")
  })

  it("uses current date when timestamp is empty", () => {
    const result = formatDateTime("")
    // Just check it returns a valid date string
    expect(result).toMatch(/^[A-Z][a-z]+ \d{1,2}, \d{4}$/)
  })
})
