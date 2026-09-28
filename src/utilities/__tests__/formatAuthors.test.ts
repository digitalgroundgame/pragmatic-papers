import { describe, expect, it } from "vitest"

import { arrayStringToPlainText, arrayToPlaintText, formatAuthors } from "../formatAuthors"

type Author = Parameters<typeof formatAuthors>[0][number]
const author = (name: string): Author => ({ name }) as Author

describe("arrayToPlaintText", () => {
  it("returns empty string for an empty list", () => {
    expect(arrayToPlaintText([])).toBe("")
  })

  it("returns the single item for a one-element list", () => {
    expect(arrayToPlaintText(["Alice"])).toBe("Alice")
  })

  it("returns empty string when the single item is undefined", () => {
    expect(arrayToPlaintText([undefined as unknown as string])).toBe("")
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

describe("formatAuthors", () => {
  it("returns empty string for no authors", () => {
    expect(formatAuthors([])).toBe("")
  })

  it("formats a single author", () => {
    expect(formatAuthors([author("Alice")])).toBe("Alice")
  })

  it("formats two authors", () => {
    expect(formatAuthors([author("Alice"), author("Bob")])).toBe("Alice and Bob")
  })

  it("formats three authors", () => {
    expect(formatAuthors([author("Alice"), author("Bob"), author("Carol")])).toBe(
      "Alice, Bob and Carol",
    )
  })

  it("filters out authors with no name", () => {
    expect(formatAuthors([author("Alice"), { name: null } as Author])).toBe("Alice")
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
