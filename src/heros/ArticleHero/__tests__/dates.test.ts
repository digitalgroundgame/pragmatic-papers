import { describe, expect, it } from "vitest"

import { formatFullTimestamp, formatPublishedDate, formatTimeOfDay, revision } from "../dates"

// 6:56 p.m. in New York on Aug 20, 2026 (EDT, UTC-4).
const EVENING = "2026-08-20T22:56:00.000Z"

describe("formatPublishedDate", () => {
  it("abbreviates the long months AP-style, with a period", () => {
    expect(formatPublishedDate(EVENING)).toBe("Aug. 20, 2026")
  })

  it("spells out the months AP leaves alone", () => {
    expect(formatPublishedDate("2026-06-01T16:00:00.000Z")).toBe("June 1, 2026")
  })

  it("reads the date in the publication's timezone, not UTC", () => {
    // 00:30 UTC is still the previous evening in New York.
    expect(formatPublishedDate("2026-08-21T00:30:00.000Z")).toBe("Aug. 20, 2026")
  })
})

describe("formatTimeOfDay", () => {
  it("renders a newspaper time of day", () => {
    expect(formatTimeOfDay(EVENING)).toBe("6:56 p.m. ET")
  })

  it("collapses the daylight-saving abbreviation to the plain zone", () => {
    // January is EST rather than EDT; both read as ET.
    expect(formatTimeOfDay("2026-01-15T15:05:00.000Z")).toBe("10:05 a.m. ET")
  })
})

describe("formatFullTimestamp", () => {
  it("spells the instant out for the tooltip", () => {
    expect(formatFullTimestamp(EVENING)).toBe("Thursday, August 20, 2026 at 6:56 p.m. ET")
  })
})

describe("revision", () => {
  it("reports a later save on the same day as a time", () => {
    expect(revision("2026-08-20T14:00:00.000Z", EVENING)).toEqual({
      dateTime: EVENING,
      label: "Updated 6:56 p.m. ET",
    })
  })

  it("reports a save on a later day as a date", () => {
    expect(revision("2026-08-20T14:00:00.000Z", "2026-08-22T14:00:00.000Z")?.label).toBe(
      "Updated Aug. 22, 2026",
    )
  })

  it("ignores the save that publishing itself stamps", () => {
    expect(revision(EVENING, "2026-08-20T22:56:30.000Z")).toBeNull()
  })

  it("ignores a save that predates a scheduled publication", () => {
    expect(revision(EVENING, "2026-08-19T09:00:00.000Z")).toBeNull()
  })
})
