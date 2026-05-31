import { describe, expect, it } from "vitest"

import { arrayStringToPlainText, arrayToPlaintText } from "../formatAuthors"

describe("arrayToPlaintText", () => {
  it("returns empty string for an empty list", () => {
    expect(arrayToPlaintText([])).toBe("")
  })

  it("returns the single item for a one-element list", () => {
    expect(arrayToPlaintText(["Alice"])).toBe("Alice")
  })

  it("joins two items with the conjunction", () => {
    expect(arrayToPlaintText(["Alice", "Bob"])).toBe("Alice and Bob")
  })

  it("joins three items with commas and a trailing conjunction", () => {
    expect(arrayToPlaintText(["Alice", "Bob", "Carol"])).toBe("Alice, Bob and Carol")
  })

  it("joins four items correctly", () => {
    expect(arrayToPlaintText(["Alice", "Bob", "Carol", "Dave"])).toBe("Alice, Bob, Carol and Dave")
  })

  it("respects a custom conjunction", () => {
    expect(arrayToPlaintText(["Alice", "Bob"], "or")).toBe("Alice or Bob")
    expect(arrayToPlaintText(["Alice", "Bob", "Carol"], "or")).toBe("Alice, Bob or Carol")
  })

  it("adds an Oxford comma for three or more items when requested", () => {
    expect(arrayToPlaintText(["Alice", "Bob", "Carol"], "and", true)).toBe("Alice, Bob, and Carol")
    expect(arrayToPlaintText(["Alice", "Bob", "Carol", "Dave"], "and", true)).toBe(
      "Alice, Bob, Carol, and Dave",
    )
  })

  it("does not add an Oxford comma for two items even when requested", () => {
    expect(arrayToPlaintText(["Alice", "Bob"], "and", true)).toBe("Alice and Bob")
  })
})

describe("arrayStringToPlainText", () => {
  it("splits a comma-separated string and joins with conjunction", () => {
    expect(arrayStringToPlainText("Alice,Bob,Carol")).toBe("Alice, Bob and Carol")
  })

  it("respects a custom separator", () => {
    expect(arrayStringToPlainText("Alice|Bob", "|")).toBe("Alice and Bob")
  })
})
