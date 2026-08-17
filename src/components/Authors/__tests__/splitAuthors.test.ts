import { describe, expect, it } from "vitest"

import { MAX_AUTHOR_SLOTS, splitAuthors } from "@/components/Authors/splitAuthors"

const authors = (count: number): string[] =>
  Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i))

/** Total rendered items: the named authors plus the overflow indicator, if any. */
const slotsUsed = (count: number, maxSlots?: number): number => {
  const { visible, overflow } = splitAuthors(authors(count), maxSlots)
  return visible.length + (overflow > 0 ? 1 : 0)
}

describe("splitAuthors", () => {
  it("shows everyone when the list fits", () => {
    expect(splitAuthors(authors(1))).toEqual({ visible: ["A"], overflow: 0 })
    expect(splitAuthors(authors(2))).toEqual({ visible: ["A", "B"], overflow: 0 })
  })

  it("still shows everyone at exactly the cap", () => {
    expect(splitAuthors(authors(3))).toEqual({ visible: ["A", "B", "C"], overflow: 0 })
  })

  it("gives up a slot to the indicator as soon as the list overflows", () => {
    expect(splitAuthors(authors(4))).toEqual({ visible: ["A", "B"], overflow: 2 })
  })

  it("never stands in for a single author", () => {
    // The 4-author case is the one that tempts a "+1": showing A, B, C and
    // hiding D. Collapsing to "+2" keeps the row three items wide instead.
    const { overflow } = splitAuthors(authors(4))
    expect(overflow).toBeGreaterThan(1)
  })

  it("absorbs any number of extra authors into the one slot", () => {
    expect(splitAuthors(authors(9))).toEqual({ visible: ["A", "B"], overflow: 7 })
  })

  it("never exceeds the cap, whatever the author count", () => {
    for (let count = 1; count <= 12; count++) {
      expect(slotsUsed(count)).toBeLessThanOrEqual(MAX_AUTHOR_SLOTS)
    }
  })

  it("accounts for every author, shown or collapsed", () => {
    for (let count = 1; count <= 12; count++) {
      const { visible, overflow } = splitAuthors(authors(count))
      expect(visible.length + overflow).toBe(count)
    }
  })

  it("honours a custom cap", () => {
    expect(splitAuthors(authors(5), 5)).toEqual({ visible: authors(5), overflow: 0 })
    expect(splitAuthors(authors(6), 5)).toEqual({ visible: ["A", "B", "C", "D"], overflow: 2 })
    for (let maxSlots = 1; maxSlots <= 6; maxSlots++) {
      expect(slotsUsed(12, maxSlots)).toBeLessThanOrEqual(maxSlots)
    }
  })

  it("degrades to the indicator alone at a cap of one", () => {
    expect(splitAuthors(authors(4), 1)).toEqual({ visible: [], overflow: 4 })
  })

  it("returns an empty split for no authors", () => {
    expect(splitAuthors([])).toEqual({ visible: [], overflow: 0 })
  })
})
