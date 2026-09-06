import { describe, expect, it } from "vitest"

import { displayFacts } from "@/blocks/InteractiveMap/drilldown/regions"
import type { DrilldownRecord, RecordDisplay } from "@/blocks/InteractiveMap/drilldown/types"

import { childKeys, composeChild, composeIndex, composeOverview } from "../compose"
import {
  DRILLDOWN_DATA_SCHEMA,
  type DrilldownData,
  type DrilldownGeometry,
  type DrilldownPresentation,
} from "../types"

const path = (
  id: string | null,
  parentId: string | null,
  extra: Partial<{ label: string }> = {},
) => ({
  id,
  d: `M${id ?? "deco"}`,
  layer: parentId ? "district" : "circuit",
  parentId,
  inset: false,
  label: extra.label ?? null,
})

const geometry: DrilldownGeometry = {
  overview: {
    viewBox: [0, 0, 100, 100],
    flipY: true,
    paths: [
      path("ca8", null, { label: "8th Cir." }),
      path("moed", "ca8"),
      path("cafc", null),
      path(null, null),
    ],
  },
  children: {
    ca8: {
      viewBox: [0, 0, 50, 50],
      flipY: false,
      paths: [path("moed", "ca8"), path("mowd", "ca8")],
    },
    cafc: null,
  },
}

const display: RecordDisplay = {
  title: "full_name",
  category: {
    field: "party",
    values: [{ value: "D", label: "Democratic", color: "var(--map-negative-3)" }],
  },
  details: [{ field: "full_name" }],
}

const presentation: DrilldownPresentation = {
  facts: { labels: { seats: "Seats" }, hide: ["anchor"] },
  seats: { totalFact: "seats", groups: [{ fact: "seats-d", label: "D", color: "blue" }] },
  display,
}

const data: DrilldownData = {
  schema: DRILLDOWN_DATA_SCHEMA,
  generatedAt: "2026-09-05T00:00:00Z",
  source: { name: "t", version: "1" },
  regions: [
    { id: "ca8", facts: { seats: "11", anchor: "1,2" } },
    { id: "moed", facts: { seats: "7", vacant: "0" } },
    { id: "mowd", label: "W.D. Mo.", facts: { seats: "6" } },
    { id: "scotus", label: "Supreme Court", facts: { seats: "9" } },
    { id: "cit", label: "CIT", parentId: "cafc", facts: { seats: "9" } },
  ],
  records: [
    { _region: "scotus", _id: "s1", full_name: "Justice One", party: "D" },
    { _region: "ca8", _id: "j8", _role: "associate", full_name: "Circuit Justice" },
    { _region: "moed", _id: "m1", full_name: "Judge Moed" },
    { _region: "mowd", _id: "w1", full_name: "Judge Mowd" },
    { _region: "cit", _id: "c1", full_name: "Judge CIT" },
  ],
}

describe("composeIndex", () => {
  it("merges geometry, child geometry and declared regions into one hierarchy", () => {
    const index = composeIndex({ geometry, data })
    expect(index.topLevel).toEqual(["ca8", "cafc", "scotus"])
    expect(index.childrenOf.ca8).toEqual(["moed", "mowd"])
    expect(index.childrenOf.cafc).toEqual(["cit"])
    expect(index.byId.mowd?.label).toBe("W.D. Mo.")
    expect(index.byId.mowd?.hasGeometry).toBe(true)
  })
})

describe("composeOverview", () => {
  it("serves only records no child asset covers", () => {
    const asset = composeOverview({ presentation, geometry, data })
    expect(asset.payload?.records?.items.map((r) => r._id)).toEqual(["s1"])
    expect(childKeys(geometry)).toEqual(["ca8", "cafc"])
  })

  it("takes facts, seats and display from the profile and nothing else", () => {
    const hostile = {
      ...data,
      // A feed trying to smuggle presentation in. None of these keys exist on DrilldownData,
      // and compose never reads them.
      facts: { labels: { seats: "OVERRIDDEN" } },
      seats: { totalFact: "seats", groups: [{ fact: "x", label: "x", color: "red" }] },
      display: {
        ...display,
        category: { field: "party", values: [{ value: "D", label: "D", color: "red" }] },
      },
    } as unknown as DrilldownData
    const asset = composeOverview({ presentation, geometry, data: hostile })
    expect(asset.payload?.facts).toBe(presentation.facts)
    expect(asset.payload?.seats).toBe(presentation.seats)
    expect(asset.payload?.records?.display).toBe(display)
    expect(asset.payload?.records?.display.category.values[0]?.color).toBe("var(--map-negative-3)")
  })

  it("empties path facts so nothing baked into a geometry file reaches the reader", () => {
    const baked: DrilldownGeometry = {
      ...geometry,
      overview: {
        ...geometry.overview,
        paths: geometry.overview.paths.map((p) => ({
          ...p,
          facts: { seats: "999", color: "red" },
        })),
      },
    }
    const asset = composeOverview({ presentation, geometry: baked, data })
    expect(asset.paths.every((p) => Object.keys(p.facts).length === 0)).toBe(true)
    // The reader sees the data's facts through the profile's labels and hide list: `anchor`
    // is hidden, `seats` is the seat chart's machine input, and the baked 999/red never existed.
    const index = composeIndex({ geometry: baked, data })
    expect(displayFacts(index.byId.moed!, asset.payload)).toEqual([
      { key: "vacant", label: "Vacant", value: "0" },
    ])
    expect(displayFacts(index.byId.ca8!, asset.payload)).toEqual([])
  })

  it("keeps the overview's viewBox and flip", () => {
    const asset = composeOverview({ presentation, geometry, data })
    expect(asset.viewBox).toEqual([0, 0, 100, 100])
    expect(asset.flipY).toBe(true)
    expect(asset.payloadError).toBeNull()
  })
})

describe("composeChild", () => {
  it("bundles a region's geometry with the records it and its descendants own", () => {
    const asset = composeChild({ presentation, geometry, data }, "ca8")
    expect(asset?.paths.map((p) => p.id)).toEqual(["moed", "mowd"])
    expect(asset?.payload?.records?.items.map((r) => r._id).sort()).toEqual(["j8", "m1", "w1"])
    expect(asset?.payload?.regions?.map((r) => r.id)).toEqual(["ca8", "moed", "mowd"])
    expect(asset?.payload?.records?.display).toBe(display)
    // Presentation-wide settings live on the overview; the client falls back to it.
    expect(asset?.payload?.facts).toBeUndefined()
    expect(asset?.payload?.seats).toBeUndefined()
  })

  it("serves a records-only region with no geometry and its declared children", () => {
    const asset = composeChild({ presentation, geometry, data }, "cafc")
    expect(asset?.paths).toEqual([])
    expect(asset?.viewBox).toBeNull()
    expect(asset?.payload?.regions?.map((r) => r.id)).toEqual(["cit"])
    expect(asset?.payload?.records?.items.map((r) => r._id)).toEqual(["c1"])
  })

  it("returns null for a region that is not drillable", () => {
    expect(composeChild({ presentation, geometry, data }, "moed")).toBeNull()
    expect(composeChild({ presentation, geometry, data }, "hasOwnProperty")).toBeNull()
  })

  it("never serves the same record from two assets", () => {
    const overview = composeOverview({ presentation, geometry, data })
    const served = new Map<string, number>()
    const count = (items: DrilldownRecord[] | undefined) =>
      items?.forEach((r) => served.set(String(r._id), (served.get(String(r._id)) ?? 0) + 1))
    count(overview.payload?.records?.items)
    for (const key of childKeys(geometry))
      count(composeChild({ presentation, geometry, data }, key)?.payload?.records?.items)
    expect([...served.values()].every((n) => n === 1)).toBe(true)
    expect(served.size).toBe(data.records.length)
  })
})

describe("composeOverview — lookups", () => {
  it("builds a lookup table from the dataset the profile names, reading its named fields", () => {
    const asset = composeOverview({
      presentation: {
        ...presentation,
        lookups: { presidents: { dataset: "presidents", image: "photo_url", source: "src" } },
      },
      geometry,
      data: {
        ...data,
        datasets: {
          presidents: {
            "Barack Obama": { photo_url: "https://e/o.jpg", src: "https://c", other: "ignored" },
            "No Photo": { bio: "…" },
          },
        },
      },
    })
    expect(asset.payload?.lookups).toEqual({
      presidents: { "Barack Obama": { image: "https://e/o.jpg", source: "https://c" } },
    })
  })

  it("carries no table when the feed does not have the dataset the profile asked for", () => {
    const asset = composeOverview({
      presentation: { ...presentation, lookups: { presidents: { dataset: "presidents" } } },
      geometry,
      data,
    })
    expect(asset.payload?.lookups).toBeUndefined()
  })

  it("carries no table when the profile declares none, so nothing leaks in from a feed", () => {
    const asset = composeOverview({
      presentation,
      geometry,
      data: { ...data, datasets: { presidents: { X: { photo_url: "https://e/x.jpg" } } } },
    })
    expect(asset.payload?.lookups).toBeUndefined()
  })
})
