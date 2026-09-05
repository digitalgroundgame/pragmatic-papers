import { describe, expect, it } from "vitest"

import {
  buildMorphPairs,
  easeInOutCubic,
  flipYInPlace,
  largestSubpathCentre,
  lerpInto,
  lerpViewBox,
  MORPH_MIN_COMMIT_MS,
  parsePathAbs,
  sameStructure,
  serializePath,
} from "@/blocks/InteractiveMap/drilldown/morph"

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
