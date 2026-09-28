import { describe, expect, it } from "vitest"

import {
  DEFAULT_NEUTRAL,
  formatDivergingMargin,
  formatValue,
  getDivergingRedBlueLegend,
  inferValueFormat,
  pickDivergingColor,
  resolveColor,
} from "@/blocks/InteractiveMap/colorScale"

describe("colorScale", () => {
  describe("pickDivergingColor — neutral below first breakpoint, palette tiers above", () => {
    it.each([
      { value: 0.5, color: null },
      { value: 3, color: "var(--map-positive-1, #ffb8bc)" },
      { value: 10, color: "var(--map-positive-2, #f48088)" },
      { value: 25, color: "var(--map-positive-3, #e54858)" },
      { value: 50, color: "var(--map-positive-4, #d81334)" },
      { value: -0.5, color: null },
      { value: -3, color: "var(--map-negative-1, #b4d4f8)" },
      { value: -10, color: "var(--map-negative-2, #72aef3)" },
      { value: -25, color: "var(--map-negative-3, #2c86ed)" },
      { value: -50, color: "var(--map-negative-4, #126ace)" },
    ])("value=$value → $color", ({ value, color }) => {
      expect(pickDivergingColor(value)).toBe(color)
    })

    it.each([
      { value: 0, color: null },
      { value: 1, color: "var(--map-positive-1, #ffb8bc)" },
      { value: 5, color: "var(--map-positive-2, #f48088)" },
      { value: 15, color: "var(--map-positive-3, #e54858)" },
      { value: 30, color: "var(--map-positive-4, #d81334)" },
      { value: -1, color: "var(--map-negative-1, #b4d4f8)" },
      { value: -15, color: "var(--map-negative-3, #2c86ed)" },
    ])("breakpoint boundary value=$value (≥ threshold gets that tier)", ({ value, color }) => {
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

  describe("getDivergingRedBlueLegend — threshold labels scale with bias", () => {
    it("defaults to bias 1 — labels match raw breakpoints", () => {
      const entries = getDivergingRedBlueLegend()
      const labels = entries.map((e) => e.label)
      expect(labels).toEqual([
        "≥D+30",
        "≥D+15",
        "≥D+5",
        "≥D+1",
        "±1",
        "≥R+1",
        "≥R+5",
        "≥R+15",
        "≥R+30",
      ])
    })

    it("null bias behaves like bias 1", () => {
      const entries = getDivergingRedBlueLegend(null)
      expect(entries.map((e) => e.label)).toEqual(getDivergingRedBlueLegend(1).map((e) => e.label))
    })

    it("bias 2 — extremes pinned, interior breakpoints shift toward the low end", () => {
      const entries = getDivergingRedBlueLegend(2)
      const labels = entries.map((e) => e.label)
      // bp[0]=1 is pinned; interior and last shift non-linearly toward 100
      expect(labels).toEqual([
        "≥D+12.3",
        "≥D+4.9",
        "≥D+1.8",
        "≥D+1",
        "±1",
        "≥R+1",
        "≥R+1.8",
        "≥R+4.9",
        "≥R+12.3",
      ])
    })

    it("colors are always the same tiers regardless of bias", () => {
      const def = getDivergingRedBlueLegend(1)
      const biased = getDivergingRedBlueLegend(2)
      expect(biased.map((e) => e.color)).toEqual(def.map((e) => e.color))
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

    it("returns neutral fill for diverging values below the first breakpoint", () => {
      expect(
        resolveColor({
          scaleType: "divergingRedBlue",
          value: 0.5,
          overrideColor: null,
          neutralFill: "#eeeeee",
        }),
      ).toBe("#eeeeee")
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

    it("uses the default neutral fill when none is provided", () => {
      expect(
        resolveColor({
          scaleType: "perRegion",
          value: null,
          overrideColor: null,
        }),
      ).toBe(DEFAULT_NEUTRAL)
    })
  })
})
