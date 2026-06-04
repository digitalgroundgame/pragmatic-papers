import { describe, expect, it } from "vitest"

import {
  formatDivergingMargin,
  pickDivergingColor,
  resolveColor,
} from "@/blocks/InteractiveMap/colorScale"

describe("colorScale", () => {
  describe("pickDivergingColor — matches the Missouri demo palette exactly", () => {
    it.each([
      { value: 0.5, color: "#cd897f" },
      { value: 3, color: "#fd8997" },
      { value: 10, color: "#fd5864" },
      { value: 25, color: "#b7212c" },
      { value: -0.5, color: "#9499b2" },
      { value: -3, color: "#89aefd" },
      { value: -10, color: "#587ac9" },
      { value: -25, color: "#22428c" },
    ])("value=$value → $color", ({ value, color }) => {
      expect(pickDivergingColor(value)).toBe(color)
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
  })
})
