import { getInitials } from "./getInitials"

describe("getInitials", () => {
  it("returns empty string for empty input", () => {
    expect(getInitials("")).toBe("")
  })

  it("returns first two chars for single name", () => {
    expect(getInitials("Alice")).toBe("AL")
  })

  it("returns first initials of first and last name", () => {
    expect(getInitials("Alice Smith")).toBe("AS")
  })

  it("handles multiple spaces", () => {
    expect(getInitials("  Alice   Smith  ")).toBe("AS")
  })

  it("handles three names (uses first two)", () => {
    expect(getInitials("Alice B Smith")).toBe("AB")
  })

  it("returns uppercase", () => {
    expect(getInitials("alice")).toBe("AL")
  })
})
