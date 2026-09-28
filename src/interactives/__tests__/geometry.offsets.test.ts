import { describe, expect, it } from "vitest"

import { offsetGeometry } from "../geometry"
import type { GeometryFile } from "../types"

const file: GeometryFile = {
  viewBox: [0, 0, 100, 100],
  flipY: true,
  paths: [
    { id: "akd", d: "M0 0L10 10", layer: null, parentId: null, inset: true, label: null },
    { id: "cand", d: "M5 5L6 6", layer: null, parentId: null, inset: false, label: null },
  ],
}

describe("offsetGeometry", () => {
  it("moves only what an offset names, and leaves the file alone otherwise", () => {
    const moved = offsetGeometry(file, { akd: [100, -50] })
    expect(moved.paths[0]!.d).toBe("M100 -50L110 -40")
    expect(moved.paths[1]!.d).toBe("M5 5L6 6")
    // Same file back when there is nothing to do, so an untouched profile pays nothing.
    expect(offsetGeometry(file, {})).toBe(file)
    expect(offsetGeometry(file, undefined)).toBe(file)
  })

  it("ignores an offset that is not a pair of numbers", () => {
    expect(offsetGeometry(file, { akd: [1] }).paths[0]!.d).toBe("M0 0L10 10")
    expect(offsetGeometry(file, { akd: [1, Number.NaN] }).paths[0]!.d).toBe("M0 0L10 10")
  })

  it("carries everything else about a path across", () => {
    const moved = offsetGeometry(file, { akd: [1, 1] })
    expect(moved.paths[0]).toMatchObject({ id: "akd", inset: true })
    expect(moved.viewBox).toEqual(file.viewBox)
  })
})
