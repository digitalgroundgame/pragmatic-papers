import { describe, expect, it } from "vitest"

import {
  arcDims,
  arcStageHeight,
  layoutArc,
  layoutTimeline,
  MIN_SPACING,
  orderedSlots,
  planRings,
  ringCounts,
  ringSlotAngles,
  timelineStageHeight,
} from "@/blocks/InteractiveMap/drilldown/seatLayout"

describe("ringCounts / planRings", () => {
  it("distributes seats proportionally to radius and reconciles rounding", () => {
    expect(ringCounts(11, [100, 150])).toEqual([4, 7])
    expect(ringCounts(7, [100, 150, 200])).toEqual([2, 2, 3])
    expect(ringCounts(0, [100])).toEqual([1]) // a ring never drops below one slot
    // planRings never asks for more rings than seats, so a lone seat gets a lone ring
    expect(planRings(1, 120, 300, false)).toEqual({ radii: [120], counts: [1] })
  })

  it("uses the fewest rings that satisfy the minimum spacing", () => {
    const one = planRings(3, 120, 300, false)
    expect(one.radii).toHaveLength(1)
    const many = planRings(29, 132, 292, false)
    expect(many.radii.length).toBeGreaterThan(1)
    for (let i = 0; i < many.radii.length; i++) {
      const spacing =
        many.counts[i]! <= 1 ? Infinity : (Math.PI * many.radii[i]!) / (many.counts[i]! - 1)
      // the last ring may fall short only when the radial budget is exhausted
      if (i < many.radii.length - 1) expect(spacing).toBeGreaterThanOrEqual(MIN_SPACING)
    }
  })

  it("reserves radial room for the outer band", () => {
    expect(planRings(40, 132, 292, true).radii.length).toBeLessThanOrEqual(
      planRings(40, 132, 292, false).radii.length,
    )
  })
})

describe("slot angles", () => {
  it("includes both endpoints for a normal ring and buffers a tiny bench", () => {
    expect(ringSlotAngles(1, false)).toEqual([Math.PI / 2])
    const three = ringSlotAngles(3, false)
    expect(three[0]).toBeCloseTo(Math.PI)
    expect(three[2]).toBeCloseTo(0)
    const buffered = ringSlotAngles(2, true).map((a) => (a * 180) / Math.PI)
    expect(buffered.map(Math.round)).toEqual([120, 60])
  })

  it("orders slots by angle, inner ring first on ties", () => {
    const slots = orderedSlots({ radii: [100, 150], counts: [2, 3] })
    expect(slots.map((s) => [Math.round((s.angle * 180) / Math.PI), s.ring])).toEqual([
      [180, 0],
      [180, 1],
      [90, 1],
      [0, 0],
      [0, 1],
    ])
  })
})

describe("layouts", () => {
  it("places arc seats on a semicircle above the centre and band members further out", () => {
    const { seats, band, dims, bandRadius, radii } = layoutArc(6, 2, 600, 360)
    expect(seats).toHaveLength(6)
    expect(band).toHaveLength(2)
    for (const p of seats) expect(p.y).toBeLessThanOrEqual(dims.cy + 1e-6)
    expect(bandRadius).toBe(radii[radii.length - 1]! + 50)
    expect(arcDims(600, 360)).toEqual({ cx: 300, cy: 292, rMax: 262, r0: 132 })
  })

  it("wraps timeline icons into rows and sizes the stage to fit them", () => {
    const pts = layoutTimeline(5, 200) // 3 columns
    expect(pts.map((p) => p.y)).toEqual([34, 34, 34, 106, 106])
    expect(timelineStageHeight(5, 200)).toBe(220)
    expect(timelineStageHeight(21, 200)).toBe(34 + 6 * 72 + 40)
  })

  it("clamps the seat-chart stage height", () => {
    expect(arcStageHeight(null)).toBe(360)
    expect(arcStageHeight(100)).toBe(280)
    expect(arcStageHeight(900)).toBe(520)
    expect(arcStageHeight(400.7)).toBe(400)
  })
})
