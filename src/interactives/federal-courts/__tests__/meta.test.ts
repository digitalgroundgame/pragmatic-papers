import { describe, expect, it } from "vitest"

import { DRILLDOWN_DATA_SCHEMA, type DrilldownData } from "../../types"
import { federalCourtsMetaLine } from "../meta"

const base = (over: Partial<DrilldownData> = {}): DrilldownData => ({
  schema: DRILLDOWN_DATA_SCHEMA,
  generatedAt: "2026-09-01T00:00:00.000Z",
  source: { name: "court-tracker", version: "abc" },
  regions: [],
  records: [],
  ...over,
})

describe("federalCourtsMetaLine", () => {
  it("names the most recent commission in the appointment history", () => {
    expect(
      federalCourtsMetaLine({
        data: base({
          datasets: {
            appointments: [
              { full_name: "Older Judge", commission_date: "2019-01-04" },
              { full_name: "Newest Judge", commission_date: "2026-06-18" },
              { full_name: "Middle Judge", commission_date: "2024-11-01" },
            ],
          },
        }),
      }),
    ).toBe("last appointment Newest Judge, June 18, 2026")
  })

  it("falls back to the sitting bench when the feed carries no history", () => {
    expect(
      federalCourtsMetaLine({
        data: base({
          records: [
            { _region: "ca8", full_name: "Sitting Judge", commission_date: "2020-03-05" },
            { _region: "ca8", full_name: "No Date" },
          ],
        }),
      }),
    ).toBe("last appointment Sitting Judge, March 5, 2020")
  })

  it("still gives the date when a row has no name", () => {
    expect(
      federalCourtsMetaLine({
        data: base({ datasets: { appointments: [{ commission_date: "2021-07-09" }] } }),
      }),
    ).toBe("last appointment July 9, 2021")
  })

  it("says nothing rather than something wrong when no row carries a date", () => {
    expect(federalCourtsMetaLine({ data: base() })).toBeNull()
    expect(
      federalCourtsMetaLine({
        data: base({ datasets: { appointments: [{ full_name: "X", commission_date: "" }] } }),
      }),
    ).toBeNull()
    expect(
      federalCourtsMetaLine({
        data: base({ datasets: { appointments: [{ commission_date: "not-a-date" }] } }),
      }),
    ).toBeNull()
  })

  it("prefers the date the manifest states over the one we would derive", () => {
    expect(
      federalCourtsMetaLine({
        data: base({
          datasets: {
            upstream: { last_appointment: "2024-11-01" },
            appointments: [
              { full_name: "Middle Judge", commission_date: "2024-11-01" },
              { full_name: "Newest Judge", commission_date: "2026-06-18" },
            ],
          },
        }),
      }),
      // The rows say June 2026 is later; the manifest says November 2024 is the appointment
      // it tracks, and upstream's statement about its own build wins.
    ).toBe("last appointment Middle Judge, November 1, 2024")
  })

  it("still gives the stated date when no row matches it", () => {
    expect(
      federalCourtsMetaLine({
        data: base({ datasets: { upstream: { last_appointment: "2025-01-09" } } }),
      }),
    ).toBe("last appointment January 9, 2025")
  })
})
