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

describe("composeFederalCourtsSummary", () => {
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
})

const folded = {
  appointments: {
    change: {
      startYear: 2020,
      coverageFrom: 1990,
      series: [
        { party: "Republican", counts: [1, 3, 2] },
        { party: "Democratic", counts: [1, 1, 1] },
      ],
    },
    history: {
      baseYear: 1990,
      presidents: [{ name: "R1", party: "Republican" }],
      bursts: [{ month: 1, president: 0, count: 1 }],
    },
  },
}

describe("composeFederalCourtsSummary — the folded bench history", () => {
  it("hands the charts what the sync folded, without re-reading a row", () => {
    const summary = composeFederalCourtsSummary({
      presentation: federalCourtsPresentation,
      data: base({ datasets: folded }),
    })
    expect(summary.change).toEqual(folded.appointments.change)
    expect(summary.appointments).toEqual(folded.appointments.history)
  })

  it("has no history at all when the feed carried none", () => {
    const bare = composeFederalCourtsSummary({
      presentation: federalCourtsPresentation,
      data: base(),
    })
    expect(bare.change).toBeNull()
    expect(bare.appointments).toBeNull()
  })
})
