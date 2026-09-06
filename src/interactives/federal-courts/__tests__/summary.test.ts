import { describe, expect, it } from "vitest"

import { DRILLDOWN_DATA_SCHEMA, type DrilldownData } from "../../types"
import { federalCourtsPresentation } from "../presentation"
import { composeFederalCourtsSummary } from "../summary"

const base = (over: Partial<DrilldownData> = {}): DrilldownData => ({
  schema: DRILLDOWN_DATA_SCHEMA,
  generatedAt: "2026-09-01T00:00:00.000Z",
  source: { name: "court-tracker", version: "abc" },
  regions: [
    { id: "scotus", label: "SCOTUS" },
    { id: "ca8", label: "8th Cir." },
    { id: "moed", label: "E.D. Mo.", parentId: "ca8" },
  ],
  records: [],
  ...over,
})

/** Two circuits on a grid whose pitch is 8.45, the way upstream lays them out. */
const arrangement = {
  schema: "district-block/arrangement@1",
  circuits: [
    {
      circuit_id: "ca8",
      offset: [16.9, 8.45],
      matrix: [
        [1, 1],
        [1, 0],
      ],
      cell_district: { "0,0": "moed", "0,1": "moed", "1,0": "moed" },
      cell_colors: { "0,0": "r", "0,1": "d", "1,0": "vacant" },
    },
  ],
}

describe("composeFederalCourtsSummary", () => {
  it("normalises upstream's drawing offsets to whole cells", () => {
    const summary = composeFederalCourtsSummary({
      presentation: federalCourtsPresentation,
      data: base({ datasets: { arrangement } }),
    })
    // 16.9 and 8.45 are 2 and 1 cells at the pitch the offsets share.
    expect(summary.cartogram[0]).toMatchObject({ id: "ca8", offset: [2, 1], rows: 2, cols: 2 })
  })

  it("maps upstream's r/d/vacant codes onto the profile's own party values", () => {
    const summary = composeFederalCourtsSummary({
      presentation: federalCourtsPresentation,
      data: base({ datasets: { arrangement } }),
    })
    expect(summary.cartogram[0]?.cells).toEqual([
      [0, 0, "moed", "Republican"],
      [0, 1, "moed", "Democratic"],
      [1, 0, "moed", null],
    ])
  })

  it("counts what is drawn, vacancies last", () => {
    const summary = composeFederalCourtsSummary({
      presentation: federalCourtsPresentation,
      data: base({ datasets: { arrangement } }),
    })
    expect(summary.districtTotals).toEqual([
      { party: "Republican", count: 1 },
      { party: "Democratic", count: 1 },
      { party: null, count: 1 },
    ])
  })

  it("finds the Supreme Court as the top-level court with nothing under it", () => {
    const summary = composeFederalCourtsSummary({
      presentation: federalCourtsPresentation,
      data: base({
        records: [
          { _region: "scotus", _id: "b", full_name: "B", commission_date: "2010-01-01" },
          { _region: "scotus", _id: "a", full_name: "A", commission_date: "1991-01-01" },
          { _region: "ca8", _id: "c", full_name: "C" },
        ],
      }),
    })
    expect(summary.supremeCourtRegion).toBe("scotus")
    // Seniority order: the display's own `order` field, ascending.
    expect(summary.supremeCourt.map((r) => r.full_name)).toEqual(["A", "B"])
  })

  it("leaves out an associate: a circuit justice is not a seat on the bench being drawn", () => {
    const summary = composeFederalCourtsSummary({
      presentation: federalCourtsPresentation,
      data: base({
        records: [
          { _region: "scotus", _id: "a", full_name: "A" },
          { _region: "scotus", _id: "j", _role: "associate", full_name: "Riding Circuit" },
        ],
      }),
    })
    expect(summary.supremeCourt.map((r) => r.full_name)).toEqual(["A"])
  })

  it("carries labels for every region it names, so it can caption without the map's index", () => {
    const summary = composeFederalCourtsSummary({
      presentation: federalCourtsPresentation,
      data: base({ datasets: { arrangement } }),
    })
    expect(summary.labels).toMatchObject({ ca8: "8th Cir.", moed: "E.D. Mo.", scotus: "SCOTUS" })
  })

  it("degrades to an empty cartogram when the feed carries no arrangement", () => {
    const summary = composeFederalCourtsSummary({
      presentation: federalCourtsPresentation,
      data: base(),
    })
    expect(summary.cartogram).toEqual([])
    expect(summary.districtTotals).toEqual([])
  })

  it("ignores a circuit whose cells name no district", () => {
    const summary = composeFederalCourtsSummary({
      presentation: federalCourtsPresentation,
      data: base({
        datasets: {
          arrangement: {
            circuits: [{ circuit_id: "ca8", offset: [0, 0], matrix: [[1]], cell_district: {} }],
          },
        },
      }),
    })
    expect(summary.cartogram).toEqual([])
  })
})
