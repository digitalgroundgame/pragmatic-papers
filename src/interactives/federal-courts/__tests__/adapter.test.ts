import { describe, expect, it, vi } from "vitest"

import { validateDrilldownData } from "../../contract"
import { memoryFileSource } from "../../sources/files"
import { RELEASE_REF } from "../../sources/releases"
import type { DrilldownGeometry } from "../../types"
import { compactAppointment, factsFor, justiceRecord, splitLicense } from "../adapter"
import { courtTrackerFeed, readCourtTrackerSources } from "../feed"
import type { Court, Judge, Justice, SeatBlock } from "../upstream"

const court = (over: Partial<Court>): Court => ({
  court_id: "moed",
  court_name: "U.S. District Court for the Eastern District of Missouri",
  short_name: "E.D. Mo.",
  court_level: "district",
  parent_id: "ca8",
  tenure_type: "life_tenured",
  authorized_judgeships: 7,
  has_geography: true,
  is_inset: false,
  geometry_key: "moed",
  ...over,
})

const judge = (over: Partial<Judge>): Judge => ({
  cl_person_id: 1,
  full_name: "Jane Q. Judge",
  display_name: "Judge",
  court_id: "moed",
  seat_id: "MOED01",
  status: "active",
  appointing_president: "Barack Obama",
  president_party: "Democratic",
  confirmation_date: "2014-01-01",
  commission_date: "2014-01-02",
  senior_date: null,
  term_expiration_date: null,
  jd_school: "Yale Law School",
  jd_year: 1990,
  aba_rating: "Well Qualified",
  cl_profile_url: "https://www.courtlistener.com/person/1/",
  photo_url: "https://upload.wikimedia.org/x.jpg?width=330",
  photo_thumb: "assets/photos/abc.jpg",
  photo_source: "https://commons.wikimedia.org/x",
  photo_license: "CC BY-SA 4.0 — credit: Someone",
  fedsoc_basis: null,
  fedsoc_source: null,
  acs_basis: null,
  acs_source: null,
  is_chief: false,
  fedsoc_reported: false,
  acs_reported: false,
  ...over,
})

const COURTS: Court[] = [
  court({
    court_id: "scotus",
    court_name: "Supreme Court of the United States",
    short_name: "SCOTUS",
    court_level: "scotus",
    parent_id: null,
    authorized_judgeships: 9,
    has_geography: false,
    geometry_key: null,
  }),
  court({
    court_id: "ca8",
    court_name: "U.S. Court of Appeals for the Eighth Circuit",
    short_name: "8th Cir.",
    court_level: "circuit",
    parent_id: null,
    authorized_judgeships: 11,
    geometry_key: "ca8",
  }),
  court({
    court_id: "ca9",
    court_name: "U.S. Court of Appeals for the Ninth Circuit",
    short_name: "9th Cir.",
    court_level: "circuit",
    parent_id: null,
    authorized_judgeships: 29,
    geometry_key: "ca9",
  }),
  court({}),
  court({
    court_id: "cafc",
    court_name: "U.S. Court of Appeals for the Federal Circuit",
    short_name: "Fed. Cir.",
    court_level: "circuit",
    parent_id: null,
    authorized_judgeships: 12,
    has_geography: false,
    geometry_key: null,
  }),
  court({
    court_id: "uscfc",
    court_name: "U.S. Court of Federal Claims",
    short_name: "CFC",
    court_level: "specialized",
    parent_id: "cafc",
    tenure_type: "fixed_term_senior",
    authorized_judgeships: 16,
    has_geography: false,
    geometry_key: null,
  }),
  court({
    court_id: "gud",
    court_name: "District Court of Guam",
    short_name: "D. Guam",
    parent_id: "ca9",
    tenure_type: "fixed_term",
    authorized_judgeships: 1,
    is_inset: true,
  }),
]

const BLOCKS: Record<string, SeatBlock> = {
  ca8: {
    level: "circuit",
    parent_id: null,
    authorized: 11,
    total: 11,
    r: 10,
    d: 1,
    o: 0,
    vacancies: 0,
    anchor: [-101504, 2330798],
    size: null,
  },
  moed: {
    level: "district",
    parent_id: "ca8",
    authorized: 7,
    total: 9,
    r: 8,
    d: 1,
    o: 0,
    vacancies: 0,
    anchor: [484339, -528618],
    size: null,
  },
}

const JUSTICE: Justice = {
  circuit_id: "ca8",
  justice_name: "Brett Kavanaugh",
  full_name: "Brett M. Kavanaugh",
  photo_url: null,
  photo_source: null,
  photo_license: null,
  source_url: "https://www.supremecourt.gov/about/circuitassignments.aspx",
}

const SCOTUS_JUDGES = [
  judge({
    court_id: "scotus",
    seat_id: "SC09",
    full_name: "Brett M. Kavanaugh",
    display_name: "Kavanaugh",
    appointing_president: "Donald J. Trump",
    president_party: "Republican",
    is_chief: false,
    photo_url: "https://example.org/k.jpg",
    photo_license: "Public domain",
  }),
  judge({
    court_id: "scotus",
    seat_id: "SC01",
    full_name: "John G. Roberts Jr.",
    display_name: "Roberts",
    appointing_president: "George W. Bush",
    president_party: "Republican",
    is_chief: true,
  }),
]

const MANIFEST = {
  schema: "court-tracker/manifest@1",
  version: "05d95d9fcf1b",
  generated: "2026-09-05T11:10:40Z",
  files: {
    courts: "data/courts.json",
    judges: { ca8: "data/judges/ca8.json", scotus: "data/judges/scotus.json" },
    circuit_justices: "data/circuit_justices.json",
    seat_blocks: "data/seat_blocks.json",
    president_photos: "data/president_photos.json",
    appointments: "data/appointments.json",
  },
}

const FILE_MAP: Record<string, object> = {
  "data/manifest.json": MANIFEST,
  "data/courts.json": COURTS,
  "data/judges/ca8.json": [
    judge({}),
    judge({
      cl_person_id: 2,
      seat_id: "MOED02",
      full_name: "Old Senior",
      display_name: "Senior",
      status: "senior",
      senior_date: "2010-01-01",
      appointing_president: "Ronald Reagan",
      president_party: "Republican",
    }),
    judge({
      cl_person_id: null,
      seat_id: null,
      full_name: "Circuit Judge",
      display_name: "Circuit",
      court_id: "ca8",
      is_chief: true,
    }),
  ],
  "data/judges/scotus.json": SCOTUS_JUDGES,
  "data/circuit_justices.json": [JUSTICE],
  "data/seat_blocks.json": BLOCKS,
  "data/president_photos.json": {
    "Barack Obama": {
      photo_url: "https://x/o.jpg",
      photo_source: null,
      photo_license: "Public domain",
    },
  },
  "data/appointments.json": [
    {
      full_name: "Jane Q. Judge",
      court_id: "moed",
      court_level: "district",
      appointing_president: "Barack Obama",
      president_party: "Democratic",
      nomination_date: "2013-12-01",
      confirmation_date: "2014-01-01",
      commission_date: "2014-01-02",
      recess_appointment_date: "",
      senior_date: "",
      termination_date: "",
      termination_reason: "",
      date_precision: "day",
      sitting: "true",
      fjc_jid: "1",
      fedsoc_reported: "",
      acs_reported: "true",
      photo_url: "",
      photo_source: "",
      photo_license: "",
      source: "fjc",
      notes: "",
    },
  ],
}

const files = memoryFileSource(FILE_MAP)

const geometry: DrilldownGeometry = {
  overview: {
    viewBox: [0, 0, 1, 1],
    flipY: true,
    paths: [
      { id: "ca8", d: "M0 0", layer: "circuit", parentId: null, inset: false, label: null },
      { id: "ca9", d: "M0 0", layer: "circuit", parentId: null, inset: false, label: null },
      { id: "moed", d: "M0 0", layer: "district", parentId: "ca8", inset: false, label: null },
      { id: "gud", d: "M0 0", layer: "district", parentId: "ca9", inset: true, label: null },
    ],
  },
  children: { ca8: null, ca9: null, cafc: null },
}

describe("readCourtTrackerSources", () => {
  it("reads the manifest, then exactly the files it lists", async () => {
    const snap = await readCourtTrackerSources(files)
    expect(snap.version).toBe("05d95d9fcf1b")
    expect(snap.generatedAt).toBe("2026-09-05T11:10:40Z")
    expect(Object.keys(snap.raw.judges).sort()).toEqual(["ca8", "scotus"])
    expect(snap.raw.arrangement).toBeNull() // not listed
    expect(snap.raw.presidents).not.toBeNull()
  })

  it("refuses an unknown manifest schema", async () => {
    const bad = memoryFileSource({
      "data/manifest.json": { ...MANIFEST, schema: "court-tracker/manifest@2" },
    })
    await expect(readCourtTrackerSources(bad)).rejects.toThrow(
      'unexpected manifest schema "court-tracker/manifest@2"',
    )
  })
})

describe("courtTrackerFeed end to end", () => {
  it("produces a valid feed that passes referential checks against the geometry", async () => {
    const snap = await courtTrackerFeed.fetch({ ref: "test", files })
    const data = courtTrackerFeed.adapt(snap, { ref: "test" })
    const { errors } = validateDrilldownData(data, geometry)
    expect(errors).toEqual([])
    expect(data.source).toEqual({ name: "court-tracker", version: "05d95d9fcf1b", ref: "test" })
  })

  it("declares every court as a region with its label, parent and facts", async () => {
    const data = courtTrackerFeed.adapt(await courtTrackerFeed.fetch({ ref: "t", files }), {
      ref: "t",
    })
    const byId = Object.fromEntries(data.regions.map((r) => [r.id, r]))
    expect(byId.moed).toMatchObject({ label: "E.D. Mo.", parentId: "ca8" })
    expect(byId.moed?.facts).toMatchObject({
      "full-name": "U.S. District Court for the Eastern District of Missouri",
      tenure: "Life tenure",
      seats: "7",
      authorized: "7",
      active: "1",
      senior: "1",
      vacant: "6",
      "seats-r": "0",
      "seats-d": "1",
      anchor: "484339,-528618",
      summary: "7 authorized · 1 active · 1 senior · 6 vacant",
    })
    expect(byId.moed?.facts).not.toHaveProperty("region-label")
    expect(byId.ca8?.facts).toMatchObject({
      order: "8",
      "short-label": "8th",
      "children-label": "districts",
    })
    expect(byId.scotus?.facts?.order).toBe("0")
    expect(byId.scotus?.facts).not.toHaveProperty("senior")
    expect(byId.cafc?.facts?.["children-label"]).toBe("feeders")
    expect(byId.gud?.facts?.note).toMatch(/territorial district courts/)
    expect(byId.uscfc?.facts?.["note-seats"]).toMatch(/28 U.S.C. § 797/)
  })

  it("emits every judge as a record and the Circuit Justice as an associate", async () => {
    const data = courtTrackerFeed.adapt(await courtTrackerFeed.fetch({ ref: "t", files }), {
      ref: "t",
    })
    const ids = data.records.map((r) => `${r._region}:${String(r._id)}`).sort()
    expect(ids).toEqual([
      "ca8:Circuit Judge", // no seat id, no cl id → name
      "ca8:justice-ca8",
      "moed:MOED01",
      "moed:MOED02",
      "scotus:SC01",
      "scotus:SC09",
    ])
    const justice = data.records.find((r) => r._id === "justice-ca8")!
    expect(justice).toMatchObject({
      _role: "associate",
      display_name: "Circ. Justice Kavanaugh",
      appointing_president: "Donald J. Trump", // merged from the SCOTUS record
      is_chief: false,
      photo_url: "https://example.org/k.jpg",
    })
    const jane = data.records.find((r) => r._id === "MOED01")!
    expect(jane).toMatchObject({
      photo_url: "https://upload.wikimedia.org/x.jpg", // query string stripped
      photo_license: "CC BY-SA 4.0",
      photo_credit: "Someone",
      jd: "Yale Law School (1990)",
      shows_term: false,
    })
  })

  it("carries the extra datasets through, compacting the appointment history", async () => {
    const data = courtTrackerFeed.adapt(await courtTrackerFeed.fetch({ ref: "t", files }), {
      ref: "t",
    })
    expect(Object.keys(data.datasets ?? {}).sort()).toEqual(["appointments", "presidents"])
    expect((data.datasets?.appointments as unknown[])[0]).toEqual({
      full_name: "Jane Q. Judge",
      court_id: "moed",
      court_level: "district",
      appointing_president: "Barack Obama",
      president_party: "Democratic",
      confirmation_date: "2014-01-01",
      commission_date: "2014-01-02",
      senior_date: null,
      termination_date: null,
      termination_reason: null,
      sitting: true,
      fedsoc_reported: false,
      acs_reported: true,
    })
  })

  it("drops photo_thumb: we hotlink, and a field we never draw only moves the content hash", async () => {
    const data = courtTrackerFeed.adapt(await courtTrackerFeed.fetch({ ref: "t", files }), {
      ref: "t",
    })
    for (const record of data.records) expect(record).not.toHaveProperty("photo_thumb")
    for (const row of (data.datasets?.appointments ?? []) as Record<string, unknown>[])
      expect(row).not.toHaveProperty("photo_thumb")
  })

  it("carries what the manifest states about its own build, and nothing when it states none", async () => {
    const plain = courtTrackerFeed.adapt(await courtTrackerFeed.fetch({ ref: "t", files }), {
      ref: "t",
    })
    expect(plain.datasets?.upstream).toBeUndefined()

    const stated = memoryFileSource({
      ...FILE_MAP,
      "data/manifest.json": {
        ...MANIFEST,
        last_appointment: "2026-06-18",
        national_totals: { authorized: 673, active: 654, vacancies: 27, over_authorized: 8 },
      },
    })
    const data = courtTrackerFeed.adapt(await courtTrackerFeed.fetch({ ref: "t", files: stated }), {
      ref: "t",
    })
    expect(data.datasets?.upstream).toEqual({
      last_appointment: "2026-06-18",
      national_totals: { authorized: 673, active: 654, vacancies: 27, over_authorized: 8 },
    })
  })

  it("never emits a colour, a display label or an ordering of fields", async () => {
    const data = courtTrackerFeed.adapt(await courtTrackerFeed.fetch({ ref: "t", files }), {
      ref: "t",
    })
    const text = JSON.stringify(data)
    expect(text).not.toMatch(/var\(--|#[0-9a-f]{6}\b|"color"|"display"|"labels"/i)
  })
})

describe("helpers", () => {
  it("splitLicense separates the credit", () => {
    expect(splitLicense("CC BY 2.0 — credit: Jane")).toEqual({
      license: "CC BY 2.0",
      credit: "Jane",
    })
    expect(splitLicense("Public domain")).toEqual({ license: "Public domain", credit: null })
    expect(splitLicense(null)).toEqual({ license: null, credit: null })
  })

  it("factsFor shows a fixed-term court as sitting, not active/senior", () => {
    const gud = COURTS.find((c) => c.court_id === "gud")!
    const facts = factsFor(gud, undefined, [
      judge({ court_id: "gud", term_expiration_date: "2030-01-01" }),
    ])
    expect(facts.summary).toBe("Fixed-term court · 1 authorized · 1 sitting · 0 vacant")
    expect(facts).not.toHaveProperty("senior")
    expect(facts).not.toHaveProperty("anchor")
  })

  it("justiceRecord falls back to the allotment row when no SCOTUS record matches", () => {
    const r = justiceRecord({ ...JUSTICE, justice_name: "Nobody Here" }, SCOTUS_JUDGES, COURTS[0])
    expect(r.full_name).toBe("Brett M. Kavanaugh")
    expect(r.appointing_president).toBeUndefined()
  })

  it("compactAppointment turns upstream's string booleans into booleans", () => {
    const c = compactAppointment({
      full_name: "x",
      court_id: "y",
      court_level: "district",
      appointing_president: "p",
      president_party: "Republican",
      nomination_date: "",
      confirmation_date: "",
      commission_date: "1990-01-01",
      senior_date: "",
      termination_date: "1999-01-01",
      termination_reason: "Death",
      sitting: "false",
      fedsoc_reported: "true",
      acs_reported: "",
      photo_thumb: "assets/photos/z.jpg",
    })
    expect(c).toMatchObject({
      sitting: false,
      fedsoc_reported: true,
      acs_reported: false,
      confirmation_date: null,
      termination_reason: "Death",
    })
  })
})

describe("courtTrackerFeed — which revision it reads", () => {
  const releases = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  const fileAt = (ref: string) =>
    new Response(JSON.stringify({ ...MANIFEST, version: `at-${ref}` }), { status: 200 })

  /** Answers the releases API and then the contents API, recording every ref asked for. */
  function stubGithub(releaseTags: string[]) {
    const refs: string[] = []
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const href = String(url)
      if (href.includes("/releases")) return releases(releaseTags.map((tag) => ({ tag_name: tag })))
      const ref = new URL(href).searchParams.get("ref") ?? ""
      refs.push(ref)
      if (href.includes("manifest.json")) return fileAt(ref)
      return new Response("{}", { status: 200 })
    })
    return { fetchImpl: fetchImpl as unknown as typeof fetch, refs }
  }

  it("polls the newest data release, which answers the version without reading a branch", async () => {
    const { fetchImpl, refs } = stubGithub(["data-v05d95d9fcf1b", "v1.0.0"])
    await expect(courtTrackerFeed.peekVersion({ ref: RELEASE_REF, fetchImpl })).resolves.toBe(
      "05d95d9fcf1b",
    )
    expect(refs).toEqual([]) // no file was fetched at all
  })

  it("falls back to the default branch until upstream publishes its first release", async () => {
    const { fetchImpl, refs } = stubGithub(["v1.0.0"])
    await expect(courtTrackerFeed.peekVersion({ ref: RELEASE_REF, fetchImpl })).resolves.toBe(
      "at-main",
    )
    expect(refs).toEqual(["main"])
  })

  it("honours a pinned ref verbatim and never asks about releases", async () => {
    const { fetchImpl, refs } = stubGithub(["data-v05d95d9fcf1b"])
    await expect(courtTrackerFeed.peekVersion({ ref: "some-branch", fetchImpl })).resolves.toBe(
      "at-some-branch",
    )
    expect(refs).toEqual(["some-branch"])
    expect(
      (fetchImpl as unknown as { mock: { calls: [string][] } }).mock.calls.some(([u]) =>
        u.includes("/releases"),
      ),
    ).toBe(false)
  })

  it("reports the tag it actually read, so a snapshot's provenance is immutable", async () => {
    const { fetchImpl } = stubGithub(["data-v05d95d9fcf1b"])
    const snapshot = await courtTrackerFeed.fetch({ ref: RELEASE_REF, fetchImpl })
    expect(snapshot.ref).toBe("data-v05d95d9fcf1b")
  })

  it("resolves nothing when the caller supplies its own files", async () => {
    const fetchImpl = vi.fn()
    const snapshot = await courtTrackerFeed.fetch({
      ref: RELEASE_REF,
      files,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(snapshot.ref).toBeUndefined()
  })
})
