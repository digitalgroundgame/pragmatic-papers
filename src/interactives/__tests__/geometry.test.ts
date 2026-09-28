import { describe, expect, it } from "vitest"

import { svgToGeometryFile } from "../geometry"

const UPSTREAM = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -20 100 200">
  <g transform="scale(1,-1) translate(0, -160)">
    <path id="moed" data-court-id="moed" data-parent-circuit="ca8" data-layer="district" d="M0 0 L1 1"/>
    <path id="ca8" data-court-id="ca8" data-layer="circuit" d="M0 0 L2 2"/>
    <path id="akd" data-court-id="akd" data-parent-circuit="ca9" data-layer="district" data-inset="true" d="M3 3"/>
    <path d="M9 9"/>
  </g>
</svg>`

describe("svgToGeometryFile", () => {
  it("keeps structure, maps upstream's parent attribute, drops everything else", () => {
    const file = svgToGeometryFile(UPSTREAM)
    expect(file.viewBox).toEqual([-10, -20, 100, 200])
    expect(file.flipY).toBe(true)
    expect(file.paths).toEqual([
      { id: "moed", d: "M0 0 L1 1", layer: "district", parentId: "ca8", inset: false, label: null },
      { id: "ca8", d: "M0 0 L2 2", layer: "circuit", parentId: null, inset: false, label: null },
      { id: "akd", d: "M3 3", layer: "district", parentId: "ca9", inset: true, label: null },
      { id: null, d: "M9 9", layer: null, parentId: null, inset: false, label: null },
    ])
    expect(file.paths.some((p) => "facts" in p)).toBe(false)
  })

  it("yields the same geometry for a file with facts and metadata baked in", () => {
    const baked = UPSTREAM.replace(
      'data-layer="circuit"',
      'data-layer="circuit" data-parent-id="" data-seats="11" data-region-label="8th Cir." data-color="red"',
    ).replace("<g ", '<metadata>{"schema":"x","records":{"items":[]}}</metadata><g ')
    const file = svgToGeometryFile(baked)
    const ca8 = file.paths.find((p) => p.id === "ca8")
    expect(ca8).toEqual({
      id: "ca8",
      d: "M0 0 L2 2",
      layer: "circuit",
      parentId: null,
      inset: false,
      label: "8th Cir.",
    })
  })
})
