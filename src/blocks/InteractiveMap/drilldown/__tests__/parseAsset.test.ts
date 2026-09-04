import { describe, expect, it } from "vitest"

import { parseDrilldownAssetString } from "@/blocks/InteractiveMap/drilldown/parseAsset"
import { parseDrilldownAssetDocument } from "@/blocks/InteractiveMap/drilldown/parseAssetDom"
import { DRILLDOWN_SCHEMA } from "@/blocks/InteractiveMap/drilldown/types"
import { sanitizeMapSvg } from "@/blocks/InteractiveMap/sanitize"

const xmlText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const payload = {
  schema: DRILLDOWN_SCHEMA,
  regions: [{ id: "fed", label: "Federal <Circuit> & co", facts: { "data-seats": "12" } }],
  facts: { labels: { seats: "Authorized" }, hide: ["data-anchor"] },
  records: {
    items: [{ _region: "a", name: `O'Brien "Jr"`, party: "R" }],
    display: {
      title: "name",
      category: { field: "party", values: [{ value: "R", label: "Republican", color: "red" }] },
      details: [{ field: "name" }],
    },
  },
}

const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -20 100 200">
  <metadata>${xmlText(JSON.stringify(payload))}</metadata>
  <g transform="scale(1,-1) translate(0, -160)">
    <path id="a" data-region-label="Alpha &amp; Co" data-layer="parent" data-seats="6" data-note="Always shown" d="M0 0 L10 0 L10 10"/>
    <path id="a1" data-parent-id="a" data-layer="child" data-inset="true" d="M1 1 L2 2 L3 1"/>
    <path id="a" data-layer="parent" d="M20 20 L30 20 L30 30"/>
    <path d="M50 50 L60 60" stroke="#000"/>
    <path id="nod" data-layer="parent"/>
  </g>
</svg>`

describe("buildDrilldownAsset via both sources", () => {
  const fromServer = parseDrilldownAssetString(sanitizeMapSvg(FIXTURE))
  const fromDom = parseDrilldownAssetDocument(FIXTURE)

  it("reads the viewBox and detects the Y-flip group", () => {
    expect(fromServer.viewBox).toEqual([-10, -20, 100, 200])
    expect(fromServer.flipY).toBe(true)
  })

  it("extracts paths with id, structure attributes and opaque facts", () => {
    expect(fromServer.paths).toHaveLength(4) // the path with no d is dropped
    const [a, a1, a2, deco] = fromServer.paths
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

  it("decodes the <metadata> payload after entity-escaping", () => {
    expect(fromServer.payloadError).toBeNull()
    expect(fromServer.payload?.regions?.[0]).toEqual({
      id: "fed",
      label: "Federal <Circuit> & co",
      facts: { seats: "12" },
    })
    // fact keys are normalised to their bare form
    expect(fromServer.payload?.facts).toEqual({ labels: { seats: "Authorized" }, hide: ["anchor"] })
    expect(fromServer.payload?.records?.items[0]).toEqual({
      _region: "a",
      name: `O'Brien "Jr"`,
      party: "R",
    })
  })

  it("the browser DOM source produces exactly the same asset as the server source", () => {
    expect(fromDom).toEqual(fromServer)
  })

  it("the DOM source falls back to HTML parsing for malformed XML and still finds the viewBox", () => {
    const malformed = `<svg viewBox="0 0 10 10"><g><path id="x" d="M0 0L1 1"><path id="y" d="M2 2L3 3"></g></svg>`
    const asset = parseDrilldownAssetDocument(malformed)
    expect(asset.viewBox).toEqual([0, 0, 10, 10])
    expect(asset.paths.map((p) => p.id)).toEqual(["x", "y"])
  })

  it("the DOM source rejects text with no <svg> root", () => {
    expect(() => parseDrilldownAssetDocument(`<div>nope</div>`)).toThrow(/no <svg> root/)
  })
})

describe("buildDrilldownAsset edge cases", () => {
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

  it("reports invalid JSON in <metadata> without throwing", () => {
    const asset = parseDrilldownAssetString(
      `<svg viewBox="0 0 1 1"><metadata>{oops</metadata></svg>`,
    )
    expect(asset.payload).toBeNull()
    expect(asset.payloadError).toMatch(/not valid JSON/)
  })

  it("reports a payload that violates the contract", () => {
    const asset = parseDrilldownAssetString(
      `<svg viewBox="0 0 1 1"><metadata>{"schema":"other","records":{"items":[{"name":"x"}],"display":{}}}</metadata></svg>`,
    )
    expect(asset.payload).toBeNull()
    expect(asset.payloadError).toMatch(/schema must be/)
    expect(asset.payloadError).toMatch(/_region/)
  })

  it("ignores paths outside the <svg> root and reads only the first <metadata>", () => {
    const asset = parseDrilldownAssetString(
      `<path id="outside" d="M0 0"/><svg viewBox="0 0 1 1"><metadata>{"schema":"${DRILLDOWN_SCHEMA}"}</metadata><metadata>garbage</metadata><path id="in" d="M0 0"/></svg>`,
    )
    expect(asset.paths.map((p) => p.id)).toEqual(["in"])
    expect(asset.payload).toEqual({ schema: DRILLDOWN_SCHEMA })
  })
})
