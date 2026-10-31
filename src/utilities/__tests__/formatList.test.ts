import { describe, expect, it } from "vitest"

import { formatAuthors, formatList } from "../formatList"

type Author = Parameters<typeof formatAuthors>[0][number]
const author = (name: string): Author => ({ name }) as Author

describe("formatList", () => {
  it("returns empty string for an empty list", () => {
    expect(formatList([])).toBe("")
  })

  it("returns the single item for a one-element list", () => {
    expect(formatList(["Alice"])).toBe("Alice")
  })

  it("returns empty string when the single item is undefined", () => {
    expect(formatList([undefined as unknown as string])).toBe("")
  })

  it("joins two items with the conjunction", () => {
    expect(formatList(["Alice", "Bob"])).toBe("Alice and Bob")
  })

  it("joins three items with commas and a trailing conjunction", () => {
    expect(formatList(["Alice", "Bob", "Carol"])).toBe("Alice, Bob and Carol")
  })

  it("joins four items correctly", () => {
    expect(formatList(["Alice", "Bob", "Carol", "Dave"])).toBe("Alice, Bob, Carol and Dave")
  })

  it("respects a custom conjunction", () => {
    expect(formatList(["Alice", "Bob"], { conjunction: "or" })).toBe("Alice or Bob")
    expect(formatList(["Alice", "Bob", "Carol"], { conjunction: "or" })).toBe("Alice, Bob or Carol")
  })

  it("adds an Oxford comma for three or more items when requested", () => {
    expect(formatList(["Alice", "Bob", "Carol"], { conjunction: "and", oxfordComma: true })).toBe(
      "Alice, Bob, and Carol",
    )
    expect(
      formatList(["Alice", "Bob", "Carol", "Dave"], { conjunction: "and", oxfordComma: true }),
    ).toBe("Alice, Bob, Carol, and Dave")
  })

  it("does not add an Oxford comma for two items even when requested", () => {
    expect(formatList(["Alice", "Bob"], { conjunction: "and", oxfordComma: true })).toBe(
      "Alice and Bob",
    )
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
