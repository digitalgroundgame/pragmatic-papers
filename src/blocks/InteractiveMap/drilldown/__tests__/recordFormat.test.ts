import { describe, expect, it } from "vitest"

import {
  categoryOf,
  compareByField,
  formatDate,
  formatDetailLine,
  formatYears,
  initials,
  isSupernumerary,
  passesCondition,
  safeHref,
  surname,
} from "@/blocks/InteractiveMap/drilldown/recordFormat"
import type { RecordDisplay } from "@/blocks/InteractiveMap/drilldown/types"

const display: RecordDisplay = {
  title: "full_name",
  category: {
    field: "party",
    values: [
      { value: "R", label: "Republican", shortLabel: "R-appointed", color: "red" },
      { value: "D", label: "Democratic", color: "blue" },
    ],
    other: { label: "Other", color: "grey" },
  },
  status: { field: "status", supernumerary: ["senior"], labels: { senior: "Senior" } },
  details: [],
}

const now = new Date(Date.UTC(2026, 8, 4, 12))

describe("names", () => {
  it("drops generational suffixes from surnames and initials", () => {
    expect(surname("Samuel A. Alito, Jr.")).toBe("Alito")
    expect(initials("Paul Joseph Kelly Jr.")).toBe("PK")
    expect(initials("Cher")).toBe("C")
    expect(initials(null)).toBe("?")
  })
})

describe("category and status", () => {
  it("resolves declared categories and falls back to other", () => {
    expect(categoryOf({ _region: "x", party: "R" }, display)).toMatchObject({
      label: "Republican",
      color: "red",
      isOther: false,
    })
    expect(categoryOf({ _region: "x", party: "None" }, display)).toMatchObject({
      label: "Other",
      color: "grey",
      isOther: true,
    })
  })

  it("flags supernumerary status", () => {
    expect(isSupernumerary({ _region: "x", status: "senior" }, display)).toBe(true)
    expect(isSupernumerary({ _region: "x", status: "active" }, display)).toBe(false)
  })

  it("sorts by field with blanks last", () => {
    const sorted = [
      { _region: "x", d: "2001-01-01" },
      { _region: "x", d: null },
      { _region: "x", d: "1999-05-05" },
    ].sort(compareByField("d"))
    expect(sorted.map((r) => r.d)).toEqual(["1999-05-05", "2001-01-01", null])
  })
})

describe("formatting", () => {
  it("formats ISO dates in UTC and years as yr/mo", () => {
    expect(formatDate("1974-12-18")).toBe("Dec 18, 1974")
    expect(formatDate("not a date")).toBe("not a date")
    expect(formatYears(12.5)).toBe("12 yr 6 mo")
    expect(formatYears(30.5)).toBe("30 yr")
    expect(formatYears(null)).toBe("—")
  })

  it("evaluates conditions", () => {
    const r = { _region: "x", status: "active", chief: true }
    expect(passesCondition(r, undefined)).toBe(true)
    expect(passesCondition(r, { field: "status", in: ["active"] })).toBe(true)
    expect(passesCondition(r, { field: "status", notIn: ["active"] })).toBe(false)
    expect(passesCondition(r, { field: "chief", truthy: true })).toBe(true)
    expect(passesCondition(r, { field: "missing", truthy: true })).toBe(false)
  })

  it("formats each detail kind", () => {
    const r = {
      _region: "x",
      school: "Yale",
      confirmed: "2010-03-01",
      commission: "2016-09-04",
      expires: "2026-09-03",
      expires2: "2030-01-01",
      url: "https://example.com/p",
      fedsoc: true,
      basis: "membership",
      src: "https://example.com/src",
    }
    expect(formatDetailLine({ field: "school", label: "JD" }, r, now)).toEqual({
      kind: "text",
      label: "JD",
      value: "Yale",
    })
    expect(
      formatDetailLine({ field: "confirmed", format: "date", label: "Confirmed" }, r, now),
    ).toEqual({ kind: "text", label: "Confirmed", value: "Mar 1, 2010" })
    expect(
      formatDetailLine(
        { field: "commission", format: "years-since", label: "On the bench" },
        r,
        now,
      ),
    ).toEqual({ kind: "text", label: "On the bench", value: "10 yr" })
    expect(
      formatDetailLine(
        { field: "commission", format: "term", endField: "expires", label: "Term" },
        r,
        now,
      )?.kind,
    ).toBe("text")
    expect(
      (
        formatDetailLine(
          { field: "commission", format: "term", endField: "expires", label: "Term" },
          r,
          now,
        ) as { value: string }
      ).value,
    ).toMatch(/term expired Sep 3, 2026 · holding over/)
    expect(
      (
        formatDetailLine(
          { field: "commission", format: "term", endField: "expires2", label: "Term" },
          r,
          now,
        ) as { value: string }
      ).value,
    ).toMatch(/^10 yr served · 3 yr 4 mo remaining \(expires Jan 1, 2030\)$/)
    expect(formatDetailLine({ field: "url", format: "link", label: "Profile" }, r, now)).toEqual({
      kind: "link",
      label: "Profile",
      href: "https://example.com/p",
    })
    expect(
      formatDetailLine(
        {
          field: "fedsoc",
          format: "reported",
          label: "Reported affiliation",
          basisField: "basis",
          sourceField: "src",
        },
        r,
        now,
      ),
    ).toEqual({
      kind: "reported",
      label: "Reported affiliation",
      basis: "membership",
      source: "https://example.com/src",
    })
    expect(formatDetailLine({ field: "missing" }, r, now)).toBeNull()
    expect(
      formatDetailLine({ field: "school", when: { field: "fedsoc", truthy: false } }, r, now),
    ).toBeNull()
  })

  it("only allows http(s) hrefs", () => {
    expect(safeHref("https://a.b/c")).toBe("https://a.b/c")
    expect(safeHref("javascript:alert(1)")).toBeNull()
    expect(safeHref("not a url")).toBeNull()
  })
})

describe("formatDetailLine — portrait", () => {
  const lookups = {
    presidents: { "Barack Obama": { image: "https://example.com/obama.jpg", source: "https://c" } },
  }
  const line = {
    field: "by",
    label: "Appointed by",
    format: "portrait" as const,
    lookup: "presidents",
  }

  it("pairs the value with the face the lookup holds for it", () => {
    expect(
      formatDetailLine(line, { _region: "x", by: "Barack Obama" }, new Date(), lookups),
    ).toEqual({
      kind: "portrait",
      label: "Appointed by",
      value: "Barack Obama",
      image: "https://example.com/obama.jpg",
      source: "https://c",
    })
  })

  it("still names them when the lookup has no row, so a missing face costs nothing", () => {
    expect(
      formatDetailLine(line, { _region: "x", by: "Someone Else" }, new Date(), lookups),
    ).toMatchObject({ kind: "portrait", value: "Someone Else", image: null })
    expect(formatDetailLine(line, { _region: "x", by: "Barack Obama" }, new Date())).toMatchObject({
      image: null,
    })
  })

  it("drops the line when the record has no value for the field", () => {
    expect(formatDetailLine(line, { _region: "x" }, new Date(), lookups)).toBeNull()
  })
})
