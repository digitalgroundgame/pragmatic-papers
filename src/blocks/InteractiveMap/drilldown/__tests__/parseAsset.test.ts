import { describe, expect, it } from "vitest"

import { parseDrilldownAssetString } from "@/blocks/InteractiveMap/drilldown/parseAsset"
import { sanitizeMapSvg } from "@/blocks/InteractiveMap/sanitize"

const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -20 100 200">
  <metadata>{"anything":"at all"}</metadata>
  <g transform="scale(1,-1) translate(0, -160)">
    <path id="a" data-region-label="Alpha &amp; Co" data-layer="parent" data-seats="6" data-note="Always shown" d="M0 0 L10 0 L10 10"/>
    <path id="a1" data-parent-id="a" data-layer="child" data-inset="true" d="M1 1 L2 2 L3 1"/>
    <path id="a" data-layer="parent" d="M20 20 L30 20 L30 30"/>
    <path d="M50 50 L60 60" stroke="#000"/>
    <path id="nod" data-layer="parent"/>
  </g>
</svg>`

describe("parseDrilldownAssetString", () => {
  const asset = parseDrilldownAssetString(sanitizeMapSvg(FIXTURE))

  it("reads the viewBox and detects the Y-flip group", () => {
    expect(asset.viewBox).toEqual([-10, -20, 100, 200])
    expect(asset.flipY).toBe(true)
  })

  it("extracts paths with id, structure attributes and opaque facts", () => {
    expect(asset.paths).toHaveLength(4) // the path with no d is dropped
    const [a, a1, a2, deco] = asset.paths
    expect(a).toMatchObject({
      id: "a",
      label: "Alpha & Co",
      layer: "parent",
      parentId: null,
      inset: false,
      facts: { seats: "6", note: "Always shown" },
    })
    expect(a1).toMatchObject({ id: "a1", parentId: "a", inset: true, layer: "child" })
    expect(a2?.id).toBe("a")
    expect(deco).toMatchObject({ id: null, facts: {} })
  })

  it("carries no payload: records reach the engine from a feed, never from a file", () => {
    expect(asset.payload).toBeNull()
    expect(asset.payloadError).toBeNull()
  })
})

describe("parseDrilldownAssetString edge cases", () => {
  it("returns a null viewBox for a missing or malformed attribute", () => {
    expect(parseDrilldownAssetString(`<svg><path d="M0 0"/></svg>`).viewBox).toBeNull()
    expect(parseDrilldownAssetString(`<svg viewBox="0 0 -1 5"/>`).viewBox).toBeNull()
    expect(parseDrilldownAssetString(`<svg viewBox="a b c d"/>`).viewBox).toBeNull()
  })

  it("does not flag flipY when the first group has no scale(1,-1)", () => {
    const asset = parseDrilldownAssetString(
      `<svg viewBox="0 0 1 1"><g transform="translate(3,4)"><path id="a" d="M0 0"/></g></svg>`,
    )
    expect(asset.flipY).toBe(false)
  })

  it("ignores paths outside the <svg> root", () => {
    const asset = parseDrilldownAssetString(
      `<path id="outside" d="M0 0"/><svg viewBox="0 0 1 1"><path id="in" d="M0 0"/></svg>`,
    )
    expect(asset.paths.map((p) => p.id)).toEqual(["in"])
  })
})
