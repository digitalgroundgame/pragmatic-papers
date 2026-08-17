import { describe, expect, it } from "vitest"

import { getSeparator, type SeparatorVariant } from "@/utilities/getSeparator"

/** Rebuild the byline the way ArticleHero does, so the assertions read as prose. */
const join = (names: string[], variant?: SeparatorVariant): string =>
  names.map((name, index) => `${getSeparator(index, names.length, variant) ?? ""}${name}`).join("")

describe("getSeparator", () => {
  it("returns no separator before the first author", () => {
    expect(getSeparator(0, 1)).toBeUndefined()
    expect(getSeparator(0, 3)).toBeUndefined()
  })

  it("joins two authors with a bare ampersand", () => {
    expect(getSeparator(1, 2)).toBe(" & ")
  })

  it("joins three or more authors with an Oxford comma before the ampersand", () => {
    expect(getSeparator(1, 3)).toBe(", ")
    expect(getSeparator(2, 3)).toBe(", & ")
  })

  it("uses a plain comma for every author but the last", () => {
    expect(getSeparator(1, 4)).toBe(", ")
    expect(getSeparator(2, 4)).toBe(", ")
    expect(getSeparator(3, 4)).toBe(", & ")
  })

  it("builds the expected byline", () => {
    expect(join(["Ada Lovelace"])).toBe("Ada Lovelace")
    expect(join(["Ada Lovelace", "Grace Hopper"])).toBe("Ada Lovelace & Grace Hopper")
    expect(join(["Ada Lovelace", "Grace Hopper", "Radia Perlman"])).toBe(
      "Ada Lovelace, Grace Hopper, & Radia Perlman",
    )
  })

  describe("bullet variant", () => {
    it("separates every author with a bullet regardless of count", () => {
      expect(getSeparator(0, 3, "bullet")).toBeUndefined()
      expect(getSeparator(1, 2, "bullet")).toBe(" • ")
      expect(getSeparator(1, 3, "bullet")).toBe(" • ")
      expect(getSeparator(2, 3, "bullet")).toBe(" • ")
    })

    it("carries its own spacing, since the byline is inline flow", () => {
      expect(join(["Ada Lovelace", "Grace Hopper", "Radia Perlman"], "bullet")).toBe(
        "Ada Lovelace • Grace Hopper • Radia Perlman",
      )
    })
  })
})
