import { describe, expect, it, vi } from "vitest"

import { validateDrilldownData } from "../../contract"
import { memoryFileSource, withJson } from "@/integrations/files"
import { tarGz } from "@/integrations/__tests__/tarFixture"
import { RELEASE_REF } from "@/integrations/github"
import type { DrilldownGeometry } from "../../types"
import ANCHORS from "../geometry/anchors.json"
import { factsFor, justiceRecord, splitLicense } from "../adapter"
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
      recess_appointment_date: null,
      senior_date: null,
      termination_date: null,
      termination_reason: null,
      date_precision: "day",
      sitting: true,
      fjc_jid: 1,
      fedsoc_reported: null,
      acs_reported: true,
      photo_url: null,
      photo_source: null,
      photo_license: null,
      source: "fjc",
      notes: null,
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
    expect(snap.raw.presidents).not.toBeNull()
  })

  it("keys the judge bundles in the manifest's order, whatever order the reads land in", async () => {
    // Assigning each bundle as its read lands would make the record order — and the content
    // hash over it — depend on the network, so two syncs of the same data would disagree.
    const slow = withJson({
      describe: () => "slow",
      read: (path: string) =>
        new Promise<string>((resolve) =>
          setTimeout(() => resolve(files.read(path)), path.includes("judges/ca8") ? 5 : 0),
        ),
    })
    const snap = await readCourtTrackerSources(slow)
    expect(Object.keys(snap.raw.judges)).toEqual(["ca8", "scotus"])
  })

  it("reads a manifest that states the shape version it was built to", async () => {
    const stated = memoryFileSource({
      ...FILE_MAP,
      "data/manifest.json": { ...MANIFEST, schema_version: "2.4.0" },
    })
    await expect(readCourtTrackerSources(stated)).resolves.toMatchObject({
      version: "05d95d9fcf1b",
    })
  })

  it("refuses a MAJOR shape bump here, where the message can say what happened", async () => {
    const moved = memoryFileSource({
      ...FILE_MAP,
      "data/manifest.json": { ...MANIFEST, schema_version: "3.0.0" },
    })
    await expect(readCourtTrackerSources(moved)).rejects.toThrow(
      /data schema 3\.0\.0 is not the 2\.x this adapter reads/,
    )
  })

  it("refuses a release built to the 1.x shape it no longer reads", async () => {
    const stale = memoryFileSource({
      ...FILE_MAP,
      "data/manifest.json": { ...MANIFEST, schema_version: "1.0.0" },
    })
    await expect(readCourtTrackerSources(stale)).rejects.toThrow(/data schema 1\.0\.0/)
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
    // The label is the full name with the boilerplate off, not upstream's citation
    // abbreviation ("E.D. Mo."), which stays reachable as the `heading` fact below.
    expect(byId.moed).toMatchObject({ label: "Eastern District of Missouri", parentId: "ca8" })
    expect(byId.ca9).toMatchObject({ label: "Ninth Circuit" })
    // Nothing to strip: the three national courts are already named in words.
    expect(byId.uscfc).toMatchObject({ label: "U.S. Court of Federal Claims" })
    // The counts are upstream's published block, not a re-derivation from the judge rows: this
    // court seats nine active judges against seven authorized, because roving judgeships are
    // shared across a state, and "authorized minus active" would report vacancies it does not
    // have. `senior` is the one count they do not publish, so it is still counted here.
    expect(byId.moed?.facts).toMatchObject({
      heading: "U.S. District Court for the Eastern District of Missouri",
      tenure: "Life tenure",
      seats: "9",
      authorized: "7",
      active: "9",
      senior: "1",
      vacant: "0",
      "seats-r": "8",
      "seats-d": "1",
      anchor: ANCHORS.moed.join(","),
      summary: "7 authorized · 9 active · 1 senior · Life tenure",
    })
    // The Supreme Court has no territory, so upstream publishes no block for it; its counts
    // come from the rows instead.
    expect(byId.scotus?.facts).toMatchObject({ seats: "9", authorized: "9", active: "2" })
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

  it("carries the extra datasets through, with the appointment history already folded", async () => {
    const data = courtTrackerFeed.adapt(await courtTrackerFeed.fetch({ ref: "t", files }), {
      ref: "t",
    })
    expect(Object.keys(data.datasets ?? {}).sort()).toEqual(["appointments", "presidents"])
    // Not a row in sight: what a snapshot carries is the two foldings the charts draw.
    expect(data.datasets?.appointments).toEqual({
      change: null, // one commission, so the series would start after it ends
      history: {
        baseYear: 2014,
        presidents: [{ name: "Barack Obama", party: "Democratic" }],
        bursts: [{ month: 0, president: 0, count: 1 }],
      },
    })
  })

  it("drops photo_thumb: we hotlink, and a field we never draw only moves the content hash", async () => {
    const data = courtTrackerFeed.adapt(await courtTrackerFeed.fetch({ ref: "t", files }), {
      ref: "t",
    })
    for (const record of data.records) expect(record).not.toHaveProperty("photo_thumb")
    // The appointment rows carried one too; folding them away takes it with them.
    expect(JSON.stringify(data.datasets?.appointments)).not.toContain("photo_thumb")
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

  it("factsFor omits the vacancy count when the bench is full", () => {
    const moed = COURTS.find((c) => c.court_id === "moed")!
    const seats = moed.authorized_judgeships ?? 0
    const full = Array.from({ length: seats }, (_, i) =>
      judge({ court_id: "moed", seat_id: `MOED0${i}` }),
    )
    const facts = factsFor(moed, undefined, full)
    expect(facts.vacant).toBe("0")
    expect(facts.summary).not.toContain("vacant")
    expect(facts.summary).toBe(`${seats} authorized · ${seats} active · 0 senior · Life tenure`)
  })

  it("factsFor places a seat block from our own anchors, not from the feed's", () => {
    const moed = COURTS.find((c) => c.court_id === "moed")!
    const moved = { ...BLOCKS.moed!, anchor: [1, 2] as [number, number] }
    // Upstream tiers `anchor` as placement for their own map; ours is checked in beside the
    // geometry it is measured against, so their layout cannot move ours from under us.
    expect(factsFor(moed, moved, []).anchor).toBe(ANCHORS.moed.join(","))
  })

  it("factsFor shows a fixed-term court as sitting, not active/senior", () => {
    const gud = COURTS.find((c) => c.court_id === "gud")!
    const facts = factsFor(gud, undefined, [
      judge({ court_id: "gud", term_expiration_date: "2030-01-01" }),
    ])
    expect(facts.summary).toBe("1 authorized · 1 sitting · Fixed term")
    expect(facts).not.toHaveProperty("senior")
  })

  it("justiceRecord falls back to the allotment row when no SCOTUS record matches", () => {
    const r = justiceRecord({ ...JUSTICE, justice_name: "Nobody Here" }, SCOTUS_JUDGES, COURTS[0])
    expect(r.full_name).toBe("Nobody Here")
    expect(r.appointing_president).toBeUndefined()
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

  /**
   * Answers the releases API, the release-asset download and the contents API, recording
   * every ref a file was asked for. `assets` names what each release has attached.
   */
  function stubGithub(releaseTags: string[], assets: string[] = []) {
    const refs: string[] = []
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const href = String(url)
      if (href.includes("/releases/assets/")) {
        return new Response(
          tarGz({ ...FILE_MAP, "data/manifest.json": { ...MANIFEST, version: "from-archive" } }),
          { status: 200 },
        )
      }
      if (href.includes("/releases")) {
        return releases(
          releaseTags.map((tag) => ({
            tag_name: tag,
            assets: assets.map((name, i) => ({
              name,
              url: `https://api.github.com/repos/o/r/releases/assets/${i}`,
            })),
          })),
        )
      }
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

  it("takes the whole feed from the release's JSON archive, in one request", async () => {
    const { fetchImpl, refs } = stubGithub(
      ["data-v05d95d9fcf1b"],
      ["data-package.tar.gz", "data-json.tar.gz"],
    )
    const snapshot = await courtTrackerFeed.fetch({ ref: RELEASE_REF, fetchImpl })
    expect(snapshot.version).toBe("from-archive")
    expect(snapshot.ref).toBe("data-v05d95d9fcf1b")
    // Not one file was walked: the archive is the feed, and it cannot be half a build.
    expect(refs).toEqual([])
    const calls = (fetchImpl as unknown as { mock: { calls: [string][] } }).mock.calls
    expect(calls.map(([u]) => u)).toEqual([
      "https://api.github.com/repos/digitalgroundgame/court-tracker/releases?per_page=30",
      "https://api.github.com/repos/o/r/releases/assets/1",
    ])
  })

  it("walks the files at the tag when a release has no archive attached", async () => {
    const { fetchImpl, refs } = stubGithub(["data-v05d95d9fcf1b"], ["data-package.tar.gz"])
    const snapshot = await courtTrackerFeed.fetch({ ref: RELEASE_REF, fetchImpl })
    expect(snapshot.ref).toBe("data-v05d95d9fcf1b")
    expect(refs[0]).toBe("data-v05d95d9fcf1b")
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
