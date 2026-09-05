import { describe, expect, it } from "vitest"

import { DRILLDOWN_SEARCH_SCHEMA } from "@/blocks/InteractiveMap/drilldown/search"
import type { RecordDisplay } from "@/blocks/InteractiveMap/drilldown/types"

import { composeSearchIndex } from "../search"
import { DRILLDOWN_DATA_SCHEMA, type DrilldownData, type DrilldownPresentation } from "../types"

const display: RecordDisplay = {
  title: "full_name",
  category: { field: "party", values: [{ value: "R", label: "Republican", color: "red" }] },
  details: [],
}

const presentation: DrilldownPresentation = { display }

const data = (records: DrilldownData["records"]): DrilldownData => ({
  schema: DRILLDOWN_DATA_SCHEMA,
  generatedAt: "2026-09-01T00:00:00.000Z",
  source: { name: "court-tracker", version: "abc123" },
  regions: [],
  records,
})

describe("composeSearchIndex", () => {
  it("names each record with the profile's title field, not with anything the feed chose", () => {
    const index = composeSearchIndex({
      presentation,
      data: data([
        { _region: "ca8", _id: "a", full_name: "Bobby Shepherd", display_name: "IGNORE ME" },
      ]),
    })
    expect(index.schema).toBe(DRILLDOWN_SEARCH_SCHEMA)
    expect(index.entries).toEqual([{ id: "a", name: "Bobby Shepherd", region: "ca8" }])
  })

  it("skips records that could never be pinned: no id, no name", () => {
    const index = composeSearchIndex({
      presentation,
      data: data([
        { _region: "ca8", full_name: "No Id" },
        { _region: "ca8", _id: "", full_name: "Empty Id" },
        { _region: "ca8", _id: "b" },
        { _region: "ca8", _id: "c", full_name: "   " },
        { _region: "ca8", _id: "d", full_name: "Kept" },
      ]),
    })
    expect(index.entries.map((e) => e.name)).toEqual(["Kept"])
  })

  it("keeps one entry per id, so a duplicate does not offer the same result twice", () => {
    const index = composeSearchIndex({
      presentation,
      data: data([
        { _region: "ca8", _id: "a", full_name: "Bobby Shepherd" },
        { _region: "moed", _id: "a", full_name: "Bobby Shepherd" },
      ]),
    })
    expect(index.entries).toHaveLength(1)
    expect(index.entries[0]).toMatchObject({ region: "ca8" })
  })

  it("carries an associate's region as its own, so a search lands on the right bench", () => {
    const index = composeSearchIndex({
      presentation,
      data: data([
        { _region: "ca1", _id: "justice-ca1", _role: "associate", full_name: "K. B. Jackson" },
      ]),
    })
    expect(index.entries[0]).toMatchObject({ region: "ca1" })
  })

  it("sorts by name so the payload compresses and an unfiltered list reads sensibly", () => {
    const index = composeSearchIndex({
      presentation,
      data: data([
        { _region: "ca8", _id: "b", full_name: "Zeta" },
        { _region: "ca8", _id: "a", full_name: "Alpha" },
      ]),
    })
    expect(index.entries.map((e) => e.name)).toEqual(["Alpha", "Zeta"])
  })
})
