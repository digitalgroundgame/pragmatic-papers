import { describe, expect, it } from "vitest"

import {
  buildMorphPairs,
  crossApexViewBox,
  easeInCubic,
  easeInOutCubic,
  easeOutCubic,
  flipYInPlace,
  frameForContent,
  frameScale,
  frameTransform,
  largestSubpathCentre,
  lerpInto,
  lerpViewBox,
  MORPH_MIN_COMMIT_MS,
  parsePathAbs,
  pullbackViewBox,
  sameStructure,
  serializePath,
  subpathBounds,
  zoomViewBox,
} from "@/interactives/engine/morph"

describe("parsePathAbs", () => {
  it("parses absolute M/L subpaths, tolerating Z and exponents", () => {
    const subs = parsePathAbs("M0 0 L10 0 L10 10 Z M1e2 -2.5 L3 4")
    expect(subs?.map((s) => Array.from(s))).toEqual([
      [0, 0, 10, 0, 10, 10],
      [100, -2.5, 3, 4],
    ])
  })

  it("returns null for anything that is not absolute M/L", () => {
    for (const d of [
      "M0 0 l1 1",
      "M0 0 C1 1 2 2 3 3",
      "M0 0 H5",
      "L1 1",
      "M0 0 L1",
      "1 2",
      "",
      null,
    ])
      expect(parsePathAbs(d)).toBeNull()
    // comma separators and negative numbers without spaces are fine
    expect(parsePathAbs("M-1,-2L3,4")?.map((s) => Array.from(s))).toEqual([[-1, -2, 3, 4]])
  })
})

describe("structure, flip, serialize, lerp", () => {
  it("compares structure by subpath count and lengths", () => {
    expect(sameStructure(parsePathAbs("M0 0L1 1"), parsePathAbs("M5 5L6 6"))).toBe(true)
    expect(sameStructure(parsePathAbs("M0 0L1 1"), parsePathAbs("M5 5L6 6L7 7"))).toBe(false)
    expect(sameStructure(parsePathAbs("M0 0L1 1"), null)).toBe(false)
  })

  it("bakes the Y-flip into the points and serialises rounded absolute commands", () => {
    const subs = flipYInPlace(parsePathAbs("M0 1.4 L2 3.6")!, 10)
    expect(serializePath(subs)).toBe("M0 9L2 6")
  })

  it("interpolates into a work buffer", () => {
    const a = parsePathAbs("M0 0L10 10")!
    const b = parsePathAbs("M10 10L20 20")!
    const out = a.map((s) => Float64Array.from(s))
    lerpInto(a, b, out, 0.5)
    expect(Array.from(out[0]!)).toEqual([5, 5, 15, 15])
    expect(lerpViewBox([0, 0, 10, 10], [10, 10, 20, 20], 0.5)).toEqual([5, 5, 15, 15])
  })

  it("eases symmetrically and keeps the commit cap at 16 ms", () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5)
    expect(MORPH_MIN_COMMIT_MS).toBe(16)
  })

  it("moves the camera in equal ratios, not equal units", () => {
    const country = [0, 0, 1000, 1000]
    const region = [900, 900, 100, 100]
    expect(zoomViewBox(country, region, 0)).toEqual(country)
    expect(zoomViewBox(country, region, 1)).toEqual(region)
    const mid = zoomViewBox(country, region, 0.5)
    // Halfway is the geometric mean of the two scales, not the arithmetic one: 316, not 550.
    expect(mid[2]).toBeCloseTo(Math.sqrt(1000 * 100))
    // And the centre has come most of the way already, so the region is under the camera while
    // the view closes on it rather than sliding in at the end.
    const travelled = (mid[0]! + mid[2]! / 2 - 500) / (950 - 500)
    expect(travelled).toBeGreaterThan(0.6)
  })

  it("falls back to a straight line when there is no zoom to speak of", () => {
    const a = [0, 0, 100, 100]
    const b = [50, 50, 100, 100]
    expect(zoomViewBox(a, b, 0.5)).toEqual([25, 25, 100, 100])
  })

  it("measures the extent of a set of subpaths", () => {
    const a = parsePathAbs("M0 0L10 20")!
    const b = parsePathAbs("M-5 3L4 4")!
    expect(subpathBounds([a, b])).toEqual([-5, 0, 15, 20])
    expect(subpathBounds([])).toBeNull()
  })

  it("carries a flight from the overview's frame into the child's", () => {
    // The same shapes, a long way apart and half the size, as an overview and a child file
    // project them.
    const contentFrom = [0, 0, 100, 100]
    const contentTo = [1000, 1000, 50, 50]
    const childBox = [1000, 1000, 50, 50]
    // Aiming at the child's box means aiming at where those shapes sit in the overview.
    const dest = pullbackViewBox(childBox, contentFrom, contentTo)
    expect(dest).toEqual([0, 0, 100, 100])
    // Untouched at the start, where the drawing is still the overview's own...
    const country = [-500, -500, 2000, 2000]
    expect(frameForContent(country, contentFrom, contentTo, 0)).toEqual(country)
    // ...and landed exactly on the child's own box at the end.
    expect(frameForContent(dest, contentFrom, contentTo, 1)).toEqual(childBox)
  })

  it("places one file's own content into the frame the morph has reached", () => {
    const overview = [0, 0, 100, 100]
    const child = [1000, 1000, 50, 50]
    // At the country the overview's shapes are already where they belong...
    expect(frameTransform(overview, overview)).toBe("translate(0 0) scale(1)")
    // ...and the child's are a whole projection away, so they are brought onto it.
    expect(frameTransform(child, overview)).toBe("translate(-2000 -2000) scale(2)")
  })

  it("reports the scale a frame transform carries, for anything sized in pixels", () => {
    const overview = [0, 0, 100, 100]
    const child = [1000, 1000, 50, 50]
    expect(frameScale(overview, overview)).toBe(1)
    expect(frameScale(child, overview)).toBe(2)
    // Seat blocks divide by it to stay the size they were drawn, so it has to agree with the
    // transform the rest of the group is getting.
    expect(frameTransform(child, overview)).toBe(
      `translate(-2000 -2000) scale(${frameScale(child, overview)})`,
    )
  })

  it("pulls a crossing back only as far as it takes to hold both maps", () => {
    const country = [0, 0, 1000, 500]
    const near = crossApexViewBox([100, 100, 40, 20], [200, 120, 40, 20], country)
    // Two maps a short way apart: a view of the ground between them, not a national one.
    expect(near[2]).toBeLessThan(country[2]! / 2)
    expect(near[0]! + near[2]! / 2).toBeCloseTo(170)
    // Opposite ends: as far out as the country and no further, since the country is what the
    // shapes have become by then and there is nothing past it to show.
    const far = crossApexViewBox([0, 0, 40, 20], [960, 480, 40, 20], country)
    expect(far[2]).toBeCloseTo(country[2]!)
    expect(far[3]).toBeCloseTo(country[3]!)
  })

  it("crosses the join at speed rather than coming to rest on it", () => {
    for (const ease of [easeInCubic, easeOutCubic]) {
      expect(ease(0)).toBe(0)
      expect(ease(1)).toBe(1)
    }
    // The leaving half is still slow when the arriving half is already fast: both are at full
    // speed at the handover, which is what keeps the country from being a stop.
    expect(easeInCubic(0.1)).toBeLessThan(easeOutCubic(0.1))
    expect(easeInCubic(0.9)).toBeLessThan(easeOutCubic(0.9))
  })
})

describe("buildMorphPairs", () => {
  const overview = [
    { key: "shape:a", d: "M0 0 L10 0 L10 10", inset: false },
    { key: "shape:b", d: "M20 20 L30 20", inset: false },
    { key: "shape:ak", d: "M1 1 L2 2", inset: true },
    { key: "outline:p", d: "M0 0 L10 0 L10 10", inset: false },
  ]
  const local = [
    { key: "shape:a", d: "M100 100 L200 100 L200 200", inset: false },
    { key: "shape:ak", d: "M500 500 L600 600", inset: true },
    { key: "outline:p", d: "M100 100 L200 100 L200 200", inset: false },
    { key: "shape:new", d: "M7 7 L8 8", inset: false },
  ]

  it("pairs twins, fades unpaired overview shapes out and local-only shapes in", () => {
    const pairing = buildMorphPairs(overview, local, 10, 1000)
    expect(pairing).not.toBeNull()
    expect(pairing!.pairs.map((p) => p.key)).toEqual(["shape:a", "outline:p"])
    // y baked: overview k=10 → 10-0=10 ; local k=1000 → 1000-100=900
    expect(serializePath(pairing!.pairs[0]!.start)).toBe("M0 10L10 10L10 0")
    expect(serializePath(pairing!.pairs[0]!.end)).toBe("M100 900L200 900L200 800")
    expect(pairing!.fadeOut.map((f) => f.key)).toEqual(["shape:b", "shape:ak"])
    // the inset crossfades to its local placement; the local-only shape fades in
    expect(pairing!.fadeIn.map((f) => f.key)).toEqual(["shape:ak", "shape:new"])
    expect(pairing!.fadeIn[0]!.d).toBe("M500 500L600 400")
  })

  it("returns null when a twin breaks the vertex invariant", () => {
    const broken = [{ key: "shape:a", d: "M0 0 L1 1", inset: false }]
    expect(buildMorphPairs(overview, broken, 10, 1000)).toBeNull()
  })

  it("returns null when an overview path is not absolute M/L", () => {
    expect(
      buildMorphPairs([{ key: "x", d: "M0 0 c1 1 2 2 3 3", inset: false }], local, 0, 0),
    ).toBeNull()
  })

  it("returns null when nothing would interpolate (only an inset callout)", () => {
    expect(
      buildMorphPairs(
        [{ key: "shape:ak", d: "M1 1 L2 2", inset: true }],
        [{ key: "shape:ak", d: "M5 5 L6 6", inset: true }],
        0,
        0,
      ),
    ).toBeNull()
  })
})

describe("largestSubpathCentre", () => {
  it("returns the centre of the biggest sub-path's bbox, not the whole shape's", () => {
    expect(largestSubpathCentre("M0 0 L10 0 L10 10 L0 10 M100 100 L101 101")).toEqual([5, 5])
    expect(largestSubpathCentre("M0 0 c1 1 2 2 3 3")).toBeNull()
  })
})
