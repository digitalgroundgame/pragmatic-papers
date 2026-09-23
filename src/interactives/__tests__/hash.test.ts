import { describe, expect, it } from "vitest"

import { geometryHash, hashDrilldownData, profileFingerprint, stableStringify } from "../hash"
import type { DrilldownGeometry, DrilldownPresentation, GeometryFile } from "../types"

const file = (d: string): GeometryFile => ({
  viewBox: [0, 0, 10, 10],
  flipY: false,
  paths: [{ id: "a", d, layer: "circuit", parentId: null, inset: false, label: null }],
})

const presentation: DrilldownPresentation = {
  display: { title: "name", category: { field: "party", values: [] }, details: [] },
}

const geometry: DrilldownGeometry = {
  overview: file("M0"),
  children: { a: file("M1"), b: null },
}

describe("stableStringify", () => {
  it("sorts object keys at every depth and leaves array order alone", () => {
    expect(stableStringify({ b: 1, a: { d: [{ z: 1, y: 2 }, 3], c: null } })).toBe(
      '{"a":{"c":null,"d":[{"y":2,"z":1},3]},"b":1}',
    )
  })
})

describe("hashDrilldownData", () => {
  const records = [{ _region: "a", _id: "1", name: "One" }]
  const base = {
    regions: [{ id: "a" }],
    records,
    source: { name: "t", version: "1" },
    generatedAt: "2026-09-01T00:00:00Z",
  }

  it("is a short hex digest that ignores provenance", () => {
    const rebuilt = {
      ...base,
      source: { name: "t", version: "2" },
      generatedAt: "2026-09-02T00:00:00Z",
    }
    expect(hashDrilldownData(base)).toMatch(/^[0-9a-f]{16}$/)
    expect(hashDrilldownData(rebuilt)).toBe(hashDrilldownData(base))
  })

  it("does not care what order a feed writes its keys in", () => {
    const reordered = { ...base, records: [{ name: "One", _id: "1", _region: "a" }] }
    expect(hashDrilldownData(reordered)).toBe(hashDrilldownData(base))
  })

  it("moves when a record or a dataset changes", () => {
    const edited = { ...base, records: [{ _region: "a", _id: "1", name: "Won" }] }
    const withDataset = { ...base, datasets: { presidents: [] } }
    expect(hashDrilldownData(edited)).not.toBe(hashDrilldownData(base))
    expect(hashDrilldownData(withDataset)).not.toBe(hashDrilldownData(base))
  })
})

describe("geometryHash", () => {
  it('names a region with no geometry "none"', () => {
    expect(geometryHash(null)).toBe("none")
  })

  it("hashes by content, so equal files share a URL and a reprojection moves it", () => {
    const one = file("M1")
    expect(geometryHash(one)).toMatch(/^[0-9a-f]{12}$/)
    expect(geometryHash(one)).toBe(geometryHash(one))
    expect(geometryHash(file("M1"))).toBe(geometryHash(one))
    expect(geometryHash(file("M2"))).not.toBe(geometryHash(one))
  })
})

describe("profileFingerprint", () => {
  const fingerprint = profileFingerprint(presentation, geometry)

  it("is stable for the same code, whatever order the children were declared in", () => {
    expect(fingerprint).toMatch(/^[0-9a-f]{12}$/)
    const reordered: DrilldownGeometry = { ...geometry, children: { b: null, a: file("M1") } }
    expect(profileFingerprint(presentation, reordered)).toBe(fingerprint)
  })

  it("moves when the presentation changes", () => {
    const relabelled = { ...presentation, facts: { labels: { seats: "Judgeships" } } }
    expect(profileFingerprint(relabelled, geometry)).not.toBe(fingerprint)
  })

  it("moves when any geometry changes or a region is added", () => {
    const reprojected = { ...geometry, children: { ...geometry.children, a: file("M9") } }
    const added = { ...geometry, children: { ...geometry.children, c: null } }
    expect(profileFingerprint(presentation, reprojected)).not.toBe(fingerprint)
    expect(profileFingerprint(presentation, added)).not.toBe(fingerprint)
  })
})
