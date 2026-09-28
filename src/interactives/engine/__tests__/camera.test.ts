import { describe, expect, it } from "vitest"

import { cameraViewBox, holdCamera } from "@/interactives/engine/geometry"
import type { ViewBox } from "@/interactives/engine/types"

const BOX: ViewBox = [0, 0, 100, 50]

describe("holdCamera", () => {
  it("keeps the zoom between the whole map and the limit", () => {
    expect(holdCamera({ k: 0.2, cx: 50, cy: 25 }, BOX, 6).k).toBe(1)
    expect(holdCamera({ k: 99, cx: 50, cy: 25 }, BOX, 6).k).toBe(6)
  })

  it("leaves a middle the frame can hold where it is", () => {
    expect(holdCamera({ k: 2, cx: 50, cy: 25 }, BOX, 6)).toEqual({ k: 2, cx: 50, cy: 25 })
  })

  it("pulls a middle the frame cannot hold back to the edge", () => {
    // At 2× the frame is 50 × 25, so its middle can reach 25 from either side and no further.
    expect(holdCamera({ k: 2, cx: 999, cy: -999 }, BOX, 6)).toEqual({ k: 2, cx: 75, cy: 12.5 })
  })
})

describe("cameraViewBox", () => {
  it("hands back the map's own box when nothing is zoomed", () => {
    expect(cameraViewBox({ k: 1, cx: 50, cy: 25 }, BOX)).toEqual(BOX)
  })

  it("cuts the box down around what the camera points at", () => {
    expect(cameraViewBox({ k: 2, cx: 50, cy: 25 }, BOX)).toEqual([25, 12.5, 50, 25])
  })
})
