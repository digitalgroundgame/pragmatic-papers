import { describe, expect, it } from "vitest"

import {
  factKey,
  humanizeFactKey,
  isReservedFact,
  notesFromFacts,
  validateDrilldownPayload,
} from "@/interactives/engine/contract"
import { DRILLDOWN_SCHEMA } from "@/interactives/engine/types"

describe("fact key helpers", () => {
  it("strips the data- prefix and lower-cases", () => {
    expect(factKey("data-Seats")).toBe("seats")
    expect(factKey("seats-r")).toBe("seats-r")
  })

  it("humanises attribute names", () => {
    expect(humanizeFactKey("active-count")).toBe("Active count")
    expect(humanizeFactKey("seats_r")).toBe("Seats r")
  })

  it("knows the reserved keys, including the note-* family", () => {
    for (const k of [
      "region-label",
      "parent-id",
      "layer",
      "inset",
      "summary",
      "note",
      "note-seats",
    ])
      expect(isReservedFact(k)).toBe(true)
    expect(isReservedFact("seats")).toBe(false)
    expect(isReservedFact("notes")).toBe(false)
  })

  it("splits notes by mode and drops blank ones", () => {
    expect(notesFromFacts({ note: "A", "note-seats": "B", "note-other": "C", seats: "1" })).toEqual(
      [
        { text: "A", mode: "always" },
        { text: "B", mode: "seats" },
      ],
    )
    expect(notesFromFacts({ note: "  " })).toEqual([])
  })
})

describe("validateDrilldownPayload", () => {
  const display = {
    title: "name",
    category: { field: "party", values: [{ value: "R", label: "Rep", color: "red" }] },
    details: [{ field: "name" }],
  }

  it("accepts a minimal valid payload", () => {
    const { payload, errors } = validateDrilldownPayload({ schema: DRILLDOWN_SCHEMA })
    expect(errors).toEqual([])
    expect(payload).toEqual({ schema: DRILLDOWN_SCHEMA })
  })

  it("normalises fact keys everywhere they appear", () => {
    const { payload } = validateDrilldownPayload({
      schema: DRILLDOWN_SCHEMA,
      regions: [{ id: "x", facts: { "data-Seats": "1" } }],
      facts: { labels: { "data-seats": "Seats" }, hide: ["DATA-anchor"], order: ["data-seats"] },
      seats: {
        totalFact: "data-seats",
        groups: [{ fact: "data-seats-r", label: "R", color: "red" }],
        anchorFact: "data-anchor",
        labelFact: "data-short",
        vacant: { label: "Vacant" },
      },
      records: { items: [], display: { ...display, seatsFact: "data-seats" } },
    })
    expect(payload?.regions?.[0]?.facts).toEqual({ seats: "1" })
    expect(payload?.facts).toEqual({
      labels: { seats: "Seats" },
      hide: ["anchor"],
      order: ["seats"],
    })
    expect(payload?.seats).toEqual({
      totalFact: "seats",
      groups: [{ fact: "seats-r", label: "R", color: "red" }],
      anchorFact: "anchor",
      labelFact: "short",
      vacant: { label: "Vacant" },
    })
    expect(payload?.records?.display.seatsFact).toBe("seats")
  })

  it("rejects non-object input and a wrong schema", () => {
    expect(validateDrilldownPayload("x").errors).toEqual(["payload must be a JSON object"])
    expect(validateDrilldownPayload({ schema: "nope" }).errors[0]).toMatch(/schema must be/)
  })

  it("reports every structural problem instead of stopping at the first", () => {
    const { payload, errors } = validateDrilldownPayload({
      schema: DRILLDOWN_SCHEMA,
      regions: [{ label: "no id" }],
      facts: { hide: "anchor" },
      seats: { totalFact: 1 },
      records: { items: [{ name: "x" }, { _region: "a", _role: "boss" }], display },
    })
    expect(payload).toBeNull()
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/regions\[0\] needs a string id/),
        expect.stringMatching(/facts.hide must be an array/),
        expect.stringMatching(/seats needs totalFact/),
        expect.stringMatching(/records.items\[0\] needs a string _region/),
        expect.stringMatching(/records.items\[1\]._role/),
      ]),
    )
  })

  it("requires the display's title, category and details", () => {
    const { errors } = validateDrilldownPayload({
      schema: DRILLDOWN_SCHEMA,
      records: { items: [], display: { category: { field: "p" } } },
    })
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/display.title/),
        expect.stringMatching(/display.category/),
        expect.stringMatching(/display.details/),
      ]),
    )
  })

  it("names each field whose type is wrong", () => {
    const cases: [unknown, string][] = [
      [{ regions: {} }, "regions must be an array"],
      [{ regions: [{ id: "a", facts: { seats: 1 } }] }, "regions[0].facts must map strings"],
      [{ facts: [] }, "facts must be an object"],
      [{ facts: { labels: { seats: 1 } } }, "facts.labels must map fact keys"],
      [{ facts: { order: "seats" } }, "facts.order must be an array"],
      [{ records: [] }, "records must be an object"],
      [{ records: { items: {} } }, "records.items must be an array"],
      [{ records: { items: [], display: "name" } }, "records.display must be an object"],
      [{ icons: "gavel" }, "icons must be an object"],
      [{ lookups: [] }, "lookups must be an object of tables"],
      [{ lookups: { presidents: "x" } }, "lookups.presidents must be an object keyed by value"],
    ]
    for (const [fields, message] of cases) {
      const { payload, errors } = validateDrilldownPayload({
        schema: DRILLDOWN_SCHEMA,
        ...(fields as object),
      })
      expect(payload).toBeNull()
      expect(errors).toEqual([expect.stringContaining(message)])
    }
  })

  it("keeps a region's label and parent", () => {
    const { payload } = validateDrilldownPayload({
      schema: DRILLDOWN_SCHEMA,
      regions: [{ id: "moed", label: "E.D. Mo.", parentId: "ca8" }],
    })
    expect(payload?.regions).toEqual([{ id: "moed", label: "E.D. Mo.", parentId: "ca8" }])
  })

  it("keeps the icon maps it can read and drops the rest without complaint", () => {
    const { payload, errors } = validateDrilldownPayload({
      schema: DRILLDOWN_SCHEMA,
      icons: { byRegion: { scotus: "landmark" }, byLayer: 3, default: "gavel" },
    })
    expect(errors).toEqual([])
    expect(payload?.icons).toEqual({ byRegion: { scotus: "landmark" }, default: "gavel" })
  })

  it("trims lookup tables to the fields a portrait reads and drops what's left empty", () => {
    const { payload, errors } = validateDrilldownPayload({
      schema: DRILLDOWN_SCHEMA,
      lookups: {
        presidents: {
          obama: { image: "obama.jpg", label: "Barack Obama", source: "wiki", party: "D" },
          nobody: { party: "D" },
          broken: "x",
        },
        empty: {},
      },
    })
    expect(errors).toEqual([])
    expect(payload?.lookups).toEqual({
      presidents: { obama: { image: "obama.jpg", label: "Barack Obama", source: "wiki" } },
    })
    expect(
      validateDrilldownPayload({ schema: DRILLDOWN_SCHEMA, lookups: { empty: {} } }).payload,
    ).toEqual({ schema: DRILLDOWN_SCHEMA })
  })
})
