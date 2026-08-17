import { describe, expect, it } from "vitest"

import { getSeparator, type SeparatorOptions } from "@/utilities/getSeparator"

/** Rebuild the byline the way ArticleHero does, so the assertions read as prose. */
const join = (names: string[], options?: SeparatorOptions): string =>
  names.map((name, index) => `${getSeparator(index, names.length, options) ?? ""}${name}`).join("")

const NAMES = ["Ada Lovelace", "Grace Hopper", "Radia Perlman"]

describe("getSeparator", () => {
  it("returns no separator before the first author", () => {
    expect(getSeparator(0, 1)).toBeUndefined()
    expect(getSeparator(0, 3)).toBeUndefined()
    expect(getSeparator(0, 3, { variant: "bullet" })).toBeUndefined()
  })

  describe("oxford variant", () => {
    it("joins two authors with a bare conjunction", () => {
      expect(getSeparator(1, 2)).toBe(" & ")
    })

    it("joins three or more authors with an Oxford comma before the conjunction", () => {
      expect(getSeparator(1, 3)).toBe(", ")
      expect(getSeparator(2, 3)).toBe(", & ")
    })

    it("uses a plain comma for every author but the last", () => {
      expect(getSeparator(1, 4)).toBe(", ")
      expect(getSeparator(2, 4)).toBe(", ")
      expect(getSeparator(3, 4)).toBe(", & ")
    })

    it("builds the expected byline", () => {
      expect(join(NAMES.slice(0, 1))).toBe("Ada Lovelace")
      expect(join(NAMES.slice(0, 2))).toBe("Ada Lovelace & Grace Hopper")
      expect(join(NAMES)).toBe("Ada Lovelace, Grace Hopper, & Radia Perlman")
    })
  })

  describe("conjunction", () => {
    it("swaps the ampersand for a word", () => {
      expect(getSeparator(1, 2, { conjunction: "and" })).toBe(" and ")
      expect(getSeparator(2, 3, { conjunction: "and" })).toBe(", and ")
    })

    it("leaves the non-final separators alone", () => {
      expect(getSeparator(1, 3, { conjunction: "and" })).toBe(", ")
    })

    it("builds the expected byline", () => {
      expect(join(NAMES.slice(0, 2), { conjunction: "and" })).toBe("Ada Lovelace and Grace Hopper")
      expect(join(NAMES, { conjunction: "and" })).toBe(
        "Ada Lovelace, Grace Hopper, and Radia Perlman",
      )
    })

    it("defaults to the ampersand", () => {
      expect(getSeparator(1, 2, {})).toBe(" & ")
    })
  })

  describe("bullet variant", () => {
    it("separates every author with a bullet regardless of count", () => {
      expect(getSeparator(1, 2, { variant: "bullet" })).toBe(" • ")
      expect(getSeparator(1, 3, { variant: "bullet" })).toBe(" • ")
      expect(getSeparator(2, 3, { variant: "bullet" })).toBe(" • ")
    })

    it("has no final conjunction to swap", () => {
      expect(getSeparator(2, 3, { variant: "bullet", conjunction: "and" })).toBe(" • ")
    })

    it("carries its own spacing, since the byline is inline flow", () => {
      expect(join(NAMES, { variant: "bullet" })).toBe("Ada Lovelace • Grace Hopper • Radia Perlman")
    })
  })
})
