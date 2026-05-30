import { describe, expect, it } from "vitest"

import { formatList, getSeparator } from "../getSeparator"

describe("getSeparator", () => {
  it("returns undefined for the first item", () => {
    expect(getSeparator(0, 3)).toBeUndefined()
  })

  it("returns bullet for non-first items", () => {
    expect(getSeparator(1, 3)).toBe("•")
  })
})

describe("formatList", () => {
  it("returns the item for a single-item list", () => {
    expect(formatList(["Alice"])).toBe("Alice")
  })

  it("joins two items with 'and'", () => {
    expect(formatList(["Alice", "Bob"])).toBe("Alice, and Bob")
  })

  it("joins three items with Oxford comma", () => {
    expect(formatList(["Alice", "Bob", "Carol"])).toBe("Alice, Bob, and Carol")
  })
})
