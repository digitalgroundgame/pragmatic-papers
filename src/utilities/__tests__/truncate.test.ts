import { describe, expect, it } from "vitest"

import { truncate } from "@/utilities/truncate"

describe("truncate", () => {
  it("leaves text within the limit alone", () => {
    expect(truncate("short", 10)).toBe("short")
    expect(truncate("exactly10!", 10)).toBe("exactly10!")
    expect(truncate("", 0)).toBe("")
  })

  it("cuts at the limit and adds an ellipsis", () => {
    expect(truncate("A long footnote about something", 6)).toBe("A long…")
    expect(truncate("abc", 0)).toBe("…")
  })

  it("drops the space a cut ends on", () => {
    expect(truncate("A long footnote", 7)).toBe("A long…")
  })

  it("backs up to a word boundary with atWord", () => {
    expect(truncate("A long footnote about something", 12, { atWord: true })).toBe("A long…")
  })

  it("drops punctuation left dangling at the boundary", () => {
    expect(truncate("One, two, three, four", 10, { atWord: true })).toBe("One, two…")
  })

  it("cuts mid-word when there's no space to back up to", () => {
    expect(truncate("Supercalifragilistic", 5, { atWord: true })).toBe("Super…")
  })
})
