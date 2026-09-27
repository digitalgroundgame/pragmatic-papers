import { describe, expect, it } from "vitest"

import { layouts, slotCounts, slotDescriptions } from "../layouts"

describe("layouts helper", () => {
  it("includes a slotCounts and slotDescriptions entry for every registered layout", () => {
    for (const key of Object.keys(layouts)) {
      expect(slotCounts[key]).toBeDefined()
      expect(slotDescriptions[key]).toBeDefined()
    }
  })

  it("derives slotCounts from minSlots/maxSlots when the layout declares a range", () => {
    expect(layouts["gauss-10"].minSlots).toBe(8)
    expect(layouts["gauss-10"].maxSlots).toBe(10)
    expect(slotCounts["gauss-10"]).toEqual([8, 10])
  })

  it("falls back to slotDescriptions.length when minSlots/maxSlots are absent", () => {
    const def = layouts["euler-2"]
    expect(def.minSlots).toBeUndefined()
    expect(def.maxSlots).toBeUndefined()
    expect(slotCounts["euler-2"]).toEqual([
      def.slotDescriptions.length,
      def.slotDescriptions.length,
    ])
  })

  it("exposes slotDescriptions matching each layout definition", () => {
    expect(slotDescriptions["gauss-10"]).toEqual(layouts["gauss-10"].slotDescriptions)
    expect(slotDescriptions["euler-2"]).toEqual(layouts["euler-2"].slotDescriptions)
  })
})
