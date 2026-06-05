import { describe, expect, it } from "vitest"

import {
  formatDivergingMargin,
  formatValue,
  inferValueFormat,
  pickDivergingColor,
  resolveColor,
} from "@/blocks/InteractiveMap/colorScale"

describe("colorScale", () => {
  describe("pickDivergingColor — matches the Missouri demo palette exactly", () => {
    it.each([
      { value: 0.5, color: "#dcb4ae" },
      { value: 3, color: "#de938a" },
      { value: 10, color: "#da685f" },
      { value: 25, color: "#cd0526" },
      { value: -0.5, color: "#bbbed8" },
      { value: -3, color: "#9fa9db" },
      { value: -10, color: "#7890df" },
      { value: -25, color: "#056ee3" },
    ])("value=$value → $color", ({ value, color }) => {
      expect(pickDivergingColor(value)).toBe(color)
    })

    it.each([
      { value: 0, color: "#dcb4ae" },
      { value: 1, color: "#de938a" },
      { value: 5, color: "#da685f" },
      { value: 15, color: "#cd0526" },
      { value: -1, color: "#9fa9db" },
      { value: -15, color: "#056ee3" },
    ])("breakpoint boundary value=$value → $color (uses strict less-than)", ({ value, color }) => {
      expect(pickDivergingColor(value)).toBe(color)
    })
  })

  describe("formatValue", () => {
    it("formats r+d- as R+/D-", () => {
      expect(formatValue("r+d-", 4.2)).toBe("R+4.2")
      expect(formatValue("r+d-", -4.2)).toBe("D+4.2")
    })

    it("formats number as a localized string", () => {
      expect(formatValue("number", 42)).toBe("42")
    })

    it("formats percent with a % suffix", () => {
      expect(formatValue("percent", 63.4)).toBe("63.4%")
    })

    it("returns null when the value is missing", () => {
      expect(formatValue("r+d-", null)).toBeNull()
      expect(formatValue("r+d-", undefined)).toBeNull()
      expect(formatValue("number", null)).toBeNull()
    })

    it("returns null for format 'none'", () => {
      expect(formatValue("none", 42)).toBeNull()
    })
  })

  describe("inferValueFormat", () => {
    it.each([
      { attr: "data-margin", expected: "r+d-" },
      { attr: "data-percent", expected: "percent" },
      { attr: "data-number", expected: "number" },
      { attr: "data-population", expected: "number" },
      { attr: null, expected: "none" },
      { attr: undefined, expected: "none" },
    ])("$attr → $expected", ({ attr, expected }) => {
      expect(inferValueFormat(attr)).toBe(expected)
    })
  })

  describe("formatDivergingMargin", () => {
    it("formats positive margins as R+", () => {
      expect(formatDivergingMargin(2.4)).toBe("R+2.4")
    })
    it("formats negative margins as D+", () => {
      expect(formatDivergingMargin(-12.5)).toBe("D+12.5")
    })
    it("rounds to one decimal place", () => {
      expect(formatDivergingMargin(7.83)).toBe("R+7.8")
    })
  })

  describe("resolveColor", () => {
    it("prefers the per-region override when set", () => {
      expect(
        resolveColor({
          scaleType: "divergingRedBlue",
          value: 10,
          overrideColor: "#abcdef",
        }),
      ).toBe("#abcdef")
    })

    it("falls back to neutral fill when value is missing", () => {
      expect(
        resolveColor({
          scaleType: "divergingRedBlue",
          value: null,
          overrideColor: null,
          neutralFill: "#eeeeee",
        }),
      ).toBe("#eeeeee")
    })

    it("returns neutral fill for the per-region scale type when no override is provided", () => {
      expect(
        resolveColor({
          scaleType: "perRegion",
          value: 10,
          overrideColor: null,
          neutralFill: "#eeeeee",
        }),
      ).toBe("#eeeeee")
    })

    it("uses the default neutral fill (#d4d4d4) when none is provided", () => {
      expect(
        resolveColor({
          scaleType: "perRegion",
          value: null,
          overrideColor: null,
        }),
      ).toBe("#d4d4d4")
    })
  })
})
