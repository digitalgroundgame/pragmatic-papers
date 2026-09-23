import { describe, expect, it } from "vitest"

import { normalizeAppointingPresident } from "../presidents"

describe("normalizeAppointingPresident", () => {
  it("collapses a two-term president's alternate spelling to one canonical string", () => {
    expect(normalizeAppointingPresident("Donald Trump")).toBe("Donald J. Trump")
    expect(normalizeAppointingPresident("Donald J. Trump")).toBe("Donald J. Trump")
  })

  it("leaves every other name and null alone", () => {
    expect(normalizeAppointingPresident("Barack Obama")).toBe("Barack Obama")
    expect(normalizeAppointingPresident(null)).toBeNull()
  })
})
