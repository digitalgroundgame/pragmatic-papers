import { describe, expect, it } from "vitest"

import { PARTIES } from "../adapter"
import { aggregateAppointments, readAppointmentSummary } from "../appointments"
import type { Appointment } from "../upstream"

const row = (over: Partial<Appointment>): Appointment => ({
  full_name: "Jane Q. Judge",
  court_id: "moed",
  court_level: "district",
  appointing_president: "R1",
  president_party: "Republican",
  nomination_date: null,
  confirmation_date: null,
  commission_date: "1990-02-01",
  senior_date: null,
  termination_date: null,
  termination_reason: null,
  sitting: true,
  fedsoc_reported: null,
  acs_reported: null,
  photo_thumb: null,
  ...over,
})

const ROWS: Appointment[] = [
  // Coverage starts in 1990, so the series starts a generation later, in 2020.
  row({ commission_date: "1990-02-01", president_party: "Republican", appointing_president: "R1" }),
  row({ commission_date: "2019-03-01", president_party: "Democratic", appointing_president: "D1" }),
  row({
    commission_date: "2021-05-01",
    president_party: "Republican",
    appointing_president: "R2",
    termination_date: "2022-06-01",
  }),
  row({ commission_date: "2021-05-15", president_party: "Republican", appointing_president: "R2" }),
]

const summary = aggregateAppointments(ROWS, PARTIES)!

describe("aggregateAppointments — change over time", () => {
  it("starts a judicial generation after coverage does, and says where coverage begins", () => {
    expect(summary.change).toMatchObject({ coverageFrom: 1990, startYear: 2020 })
  })

  it("counts who was still serving at the end of each year, dropping those who left", () => {
    // 2020, 2021: the 1990 and 2019 appointments stand; 2021 adds two more Republicans.
    const [republican, democratic] = summary.change!.series
    expect(republican).toMatchObject({ party: "Republican", counts: [1, 3, 2] })
    expect(democratic).toMatchObject({ party: "Democratic", counts: [1, 1, 1] })
  })

  it("folds nothing when the feed carries no history", () => {
    expect(aggregateAppointments(null, PARTIES)).toBeNull()
    expect(aggregateAppointments([], PARTIES)).toBeNull()
  })
})

describe("aggregateAppointments — appointment history", () => {
  it("buckets appointments by month and appointing president", () => {
    expect(summary.history).toMatchObject({ baseYear: 1990 })
    // Two commissions in the same month under the same president are one bucket of two.
    const may2021 = summary.history!.bursts.find((b) => b.count === 2)
    expect(may2021).toBeDefined()
    expect(summary.history!.presidents[may2021!.president]).toEqual({
      name: "R2",
      party: "Republican",
    })
  })

  it("keeps every appointment: the buckets sum to the rows the feed carried", () => {
    expect(summary.history!.bursts.reduce((n, b) => n + b.count, 0)).toBe(4)
  })

  it("carries a party of null for a row whose party the profile does not count", () => {
    const odd = aggregateAppointments(
      [row({ president_party: "None (reassignment)", appointing_president: "n/a" })],
      PARTIES,
    )
    expect(odd!.history!.presidents[0]).toEqual({ name: "n/a", party: null })
  })

  it("ignores a row with no commission to place it by", () => {
    const partial = aggregateAppointments([...ROWS, row({ commission_date: null })], PARTIES)
    expect(partial!.history!.bursts.reduce((n, b) => n + b.count, 0)).toBe(4)
  })
})

describe("readAppointmentSummary", () => {
  it("reads back what the sync folded", () => {
    const stored = JSON.parse(JSON.stringify({ appointments: summary })) as Record<string, unknown>
    expect(readAppointmentSummary(stored)).toEqual(summary)
  })

  it("reads nothing from a snapshot written before the fold, or from a broken one", () => {
    const none = { change: null, history: null }
    // The shape a snapshot carried while the rows were stored raw.
    expect(readAppointmentSummary({ appointments: [{ commission_date: "1990-01-01" }] })).toEqual(
      none,
    )
    expect(readAppointmentSummary(undefined)).toEqual(none)
    expect(readAppointmentSummary({ appointments: { change: { startYear: "soon" } } })).toEqual(
      none,
    )
    expect(
      readAppointmentSummary({
        appointments: { history: { baseYear: 1990, presidents: [{}], bursts: [] } },
      }),
    ).toEqual(none)
  })
})
