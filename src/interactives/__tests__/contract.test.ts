import { describe, expect, it } from "vitest"

import { geometryRegionIds, validateDrilldownData } from "../contract"
import { hashDrilldownData, stableStringify } from "../hash"
import { DRILLDOWN_DATA_SCHEMA, type DrilldownGeometry } from "../types"

const geometry: DrilldownGeometry = {
  overview: {
    viewBox: [0, 0, 10, 10],
    flipY: false,
    paths: [
      { id: "ca8", d: "M0 0", layer: "circuit", parentId: null, inset: false, label: "8th Cir." },
      {
        id: "moed",
        d: "M1 1",
        layer: "district",
        parentId: "ca8",
        inset: false,
        label: "E.D. Mo.",
      },
      { id: null, d: "M2 2", layer: null, parentId: null, inset: false, label: null },
    ],
  },
  children: {
    ca8: {
      viewBox: [0, 0, 5, 5],
      flipY: false,
      paths: [
        { id: "moed", d: "M1 1", layer: "district", parentId: "ca8", inset: false, label: null },
      ],
    },
    cafc: null,
  },
}

interface LooseFeed {
  schema: string
  generatedAt: string
  source: Record<string, unknown>
  regions: { id: string; label?: string; parentId?: string; facts: Record<string, string> }[]
  records: Record<string, unknown>[]
  datasets: Record<string, unknown>
}

function valid(): LooseFeed {
  return {
    schema: DRILLDOWN_DATA_SCHEMA,
    generatedAt: "2026-09-05T11:10:40Z",
    source: { name: "court-tracker", version: "05d95d9fcf1b", ref: "main" },
    regions: [
      { id: "ca8", facts: { "data-seats": "11", vacant: "0" } },
      { id: "moed", parentId: "ca8", facts: { seats: "7" } },
      { id: "scotus", label: "Supreme Court", facts: { seats: "9" } },
    ],
    records: [
      { _region: "moed", _id: "a", full_name: "A" },
      { _region: "ca8", _id: "j", _role: "associate", full_name: "J" },
    ],
    datasets: { presidents: { Nixon: { photo_url: "x" } }, appointments: [{ court_id: "moed" }] },
  }
}

describe("geometryRegionIds", () => {
  it("collects ids from the overview and every child, skipping decorative paths", () => {
    expect([...geometryRegionIds(geometry)].sort()).toEqual(["ca8", "moed"])
  })
})

describe("validateDrilldownData", () => {
  it("accepts a well-formed feed and normalises fact keys", () => {
    const { data, errors } = validateDrilldownData(valid(), geometry)
    expect(errors).toEqual([])
    expect(data?.regions[0]?.facts).toEqual({ seats: "11", vacant: "0" })
    expect(data?.source).toEqual({ name: "court-tracker", version: "05d95d9fcf1b", ref: "main" })
    expect(Object.keys(data?.datasets ?? {})).toEqual(["presidents", "appointments"])
  })

  it("rejects the wrong schema, a bad date and a missing source", () => {
    const { data, errors } = validateDrilldownData({
      ...valid(),
      schema: "pragmatic-papers/drilldown-map@1",
      generatedAt: "yesterday",
      source: { name: "x" },
    })
    expect(data).toBeNull()
    expect(errors).toEqual([
      expect.stringContaining('schema must be "pragmatic-papers/drilldown-data@1"'),
      "generatedAt must be an ISO 8601 date",
      "source needs a name and a version",
    ])
  })

  it("names the region a record belongs to when it does not exist", () => {
    const input = valid()
    input.records.push({ _region: "moe", _id: "b", full_name: "B" })
    input.records.push({ _region: "moe", _id: "c", full_name: "C" })
    const { data, errors } = validateDrilldownData(input, geometry)
    expect(data).toBeNull()
    expect(errors).toEqual(['2 records belong to "moe", which is not a region'])
  })

  it("rejects a declared parent that is neither drawn nor declared", () => {
    const input = valid()
    input.regions.push({ id: "cit", parentId: "cafc", facts: {} })
    const { errors } = validateDrilldownData(input, geometry)
    expect(errors).toEqual(['region "cit" names parent "cafc", which is not a region'])
  })

  it("allows geometry-less regions at the top level and under a geometry-less parent", () => {
    const input = valid()
    input.regions.push({ id: "cafc", label: "Fed. Cir.", facts: {} })
    input.regions.push({ id: "cit", parentId: "cafc", facts: {} })
    expect(validateDrilldownData(input, geometry).errors).toEqual([])
  })

  it("catches an upstream rename: a shape with no declaration beside a declaration with no shape", () => {
    const input = valid()
    input.regions = input.regions.map((r) => (r.id === "moed" ? { ...r, id: "moe" } : r))
    input.records = input.records.map((r) => (r._region === "moed" ? { ...r, _region: "moe" } : r))
    const { errors } = validateDrilldownData(input, geometry)
    expect(errors).toEqual([
      'region "moe" has no geometry but its parent "ca8" is drawn — was a region renamed upstream?',
      'geometry draws "moed" but the feed declares no such region',
    ])
  })

  it("skips referential checks without geometry so a CLI can validate a feed alone", () => {
    const input = valid()
    input.records.push({ _region: "nowhere", _id: "z" })
    expect(validateDrilldownData(input).errors).toEqual([])
  })

  it("rejects duplicate region declarations and malformed datasets", () => {
    const input = valid()
    input.regions.push({ id: "ca8", facts: {} })
    const { errors } = validateDrilldownData(
      { ...input, datasets: { photos: "not-a-dataset" } },
      geometry,
    )
    expect(errors).toEqual([
      "datasets.photos must be an array or an object",
      'regions declares "ca8" more than once',
    ])
  })

  it("reports a record without a region and a bad role by position", () => {
    const { errors } = validateDrilldownData({
      ...valid(),
      records: [{ full_name: "no region" }, { _region: "ca8", _role: "chair" }],
    })
    expect(errors).toEqual([
      "records[0] needs a string _region",
      'records[1]._role must be "seat" or "associate"',
    ])
  })
})

describe("hashDrilldownData", () => {
  it("is independent of key order and sensitive to values", () => {
    const a = { regions: [{ id: "x", facts: { seats: "1", vacant: "0" } }], records: [] }
    const b = { records: [], regions: [{ facts: { vacant: "0", seats: "1" }, id: "x" }] }
    expect(stableStringify(a)).toBe(stableStringify(b))
    expect(hashDrilldownData(a)).toBe(hashDrilldownData(b))
    expect(hashDrilldownData({ ...a, records: [{ _region: "x" }] })).not.toBe(hashDrilldownData(a))
    expect(hashDrilldownData({ ...a, datasets: { p: {} } })).not.toBe(hashDrilldownData(a))
    expect(hashDrilldownData(a)).toMatch(/^[0-9a-f]{16}$/)
  })

  it("ignores provenance, so an upstream rebuild of identical data hashes the same", () => {
    const { data: v1 } = validateDrilldownData(valid())
    const { data: v2 } = validateDrilldownData({
      ...valid(),
      generatedAt: "2026-09-06T00:00:00Z",
      source: { name: "court-tracker", version: "rebuilt", ref: "v2" },
    })
    expect(hashDrilldownData(v1!)).toBe(hashDrilldownData(v2!))
  })
})
