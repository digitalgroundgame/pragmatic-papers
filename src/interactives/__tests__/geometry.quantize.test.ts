import { describe, expect, it } from "vitest"

import { padViewBox, ZOOM_MAX } from "../engine/geometry"
import { parsePathAbs, sameStructure } from "../engine/morph"
import {
  geometryStep,
  MAX_MAP_DEVICE_PX,
  quantizeGeometry,
  scalePath,
  svgToGeometryFile,
} from "../geometry"
import NATIONAL from "../federal-courts/geometry/national.json"
import type { GeometryFile } from "../types"

describe("geometryStep", () => {
  it("is the largest 1-2-5 step that moves no vertex a device pixel at the deepest zoom", () => {
    // The national export: 5.27M units across once padded.
    const viewBox = [-2492274, -175515, 4966623, 3348083] as const
    const step = geometryStep([...viewBox])
    expect(step).toBe(200)
    const [, , w] = padViewBox([...viewBox])
    const unitsPerDevicePx = w / (MAX_MAP_DEVICE_PX * ZOOM_MAX)
    expect(step / Math.SQRT2).toBeLessThanOrEqual(unitsPerDevicePx)
  })

  it("leaves a small map, or one with no viewBox, at full precision", () => {
    expect(geometryStep([0, 0, 10, 10])).toBe(1)
    expect(geometryStep(null)).toBe(1)
  })
})

describe("scalePath", () => {
  it("divides and rounds every coordinate, keeping every command", () => {
    expect(scalePath("M1049 -2051 L3000,4049 L-149 0 Z", 100)).toBe("M10 -21L30 40L-1 0Z")
  })

  it("refuses a command whose numbers are not all coordinates", () => {
    expect(() => scalePath("M0 0 A5 5 0 0 1 10 10", 10)).toThrow(/absolute M\/L/)
    expect(() => scalePath("m0 0 l10 10", 10)).toThrow(/absolute M\/L/)
  })
})

describe("quantizeGeometry", () => {
  const file: GeometryFile = {
    viewBox: [-1000, -2000, 10000, 20000],
    flipY: true,
    paths: [
      {
        id: "a",
        d: "M-1000 -2000 L9000 18000 L1234 5678",
        layer: null,
        parentId: null,
        inset: false,
        label: null,
      },
      {
        id: "b",
        d: "M9000 18000 L1234 5678",
        layer: null,
        parentId: "a",
        inset: false,
        label: null,
      },
    ],
  }

  it("scales the viewBox with the shapes, so it still frames them exactly", () => {
    const q = quantizeGeometry(file, 100)
    expect(q.step).toBe(100)
    expect(q.viewBox).toEqual([-10, -20, 100, 200])
    expect(q.paths[0]!.d).toBe("M-10 -20L90 180L12 57")
  })

  it("rounds a vertex two shapes share to the same point in both", () => {
    const [a, b] = quantizeGeometry(file, 100).paths
    expect(a!.d.endsWith(b!.d.replace(/^M/, "L"))).toBe(true)
  })

  it("re-grids an already quantized file by the ratio of the steps, and is a no-op on its own step", () => {
    const once = quantizeGeometry(file, 100)
    expect(quantizeGeometry(once, 100).paths).toEqual(once.paths)
    expect(quantizeGeometry(once, 200).viewBox).toEqual([-5, -10, 50, 100])
  })

  it("is what the snapshot writes from an export", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4000000 2000000"><path id="x" d="M1234567 7654 L2000000 1999999"/></svg>`
    const out = svgToGeometryFile(svg)
    expect(out.step).toBe(100)
    expect(out.paths[0]!.d).toBe("M12346 77L20000 20000")
    // A checked-in file's own step wins, so offsets in its units stay right.
    expect(svgToGeometryFile(svg, 50).paths[0]!.d).toBe("M24691 153L40000 40000")
  })
})

describe("the checked-in national map", () => {
  it("is on its step, and every shape still parses as absolute M/L", () => {
    const file = NATIONAL as unknown as GeometryFile
    expect(file.step).toBe(geometryStep(file.viewBox!.map((v) => v * file.step!) as never))
    for (const p of file.paths) {
      const subs = parsePathAbs(p.d)
      expect(subs, p.id ?? "").not.toBeNull()
      expect(sameStructure(subs, parsePathAbs(scalePath(p.d, 1)))).toBe(true)
    }
  })
})
