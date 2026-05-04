import { getSeparator } from "./getSeparator"

describe("getSeparator", () => {
  it("returns undefined for first item (index 0)", () => {
    expect(getSeparator(0, 3)).toBeUndefined()
  })

  it("returns bullet for middle items", () => {
    expect(getSeparator(1, 3)).toBe("•")
  })

  it("returns bullet for last item", () => {
    expect(getSeparator(2, 3)).toBe("•")
  })

  it("returns bullet for any non-zero index", () => {
    expect(getSeparator(5, 10)).toBe("•")
  })

  it("handles length parameter (unused)", () => {
    expect(getSeparator(1, 100)).toBe("•")
  })
})
