import { describe, expect, it } from "vitest"

import { getInitials } from "../getInitials"

describe("getInitials", () => {
  it("returns empty string for empty input", () => {
    expect(getInitials("")).toBe("")
  })

  it("returns first two chars uppercased for a single word", () => {
    expect(getInitials("john")).toBe("JO")
  })

  it("returns first initials of first and last word uppercased", () => {
    expect(getInitials("john doe")).toBe("JD")
  })

  it("uses only first and second word when more than two words given", () => {
    expect(getInitials("john michael doe")).toBe("JM")
  })

  it("handles extra whitespace", () => {
    expect(getInitials("  john   doe  ")).toBe("JD")
  })
})
