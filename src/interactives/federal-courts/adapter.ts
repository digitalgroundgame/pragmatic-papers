import type { DeclaredRegion, DrilldownRecord } from "@/interactives/engine/types"

import { DRILLDOWN_DATA_SCHEMA, type DrilldownData, type FeedSnapshot } from "../types"
import { aggregateAppointments } from "./appointments"
import ANCHORS from "./geometry/anchors.json"
import type { Court, CourtTrackerSources, Judge, Justice, SeatBlock } from "./upstream"

/**
 * court-tracker → drilldown data. Everything here is a value or a meaning — counts, dates,
 * names, the statutory explainer a court's pane cites. Appearance is `presentation.ts`.
 */

/**
 * The parties a bench is counted by. Upstream states a president's party as a free string;
 * these are the two the profile counts separately, and anything else — an unaffiliated
 * appointment, a blank — falls into "other" wherever a count is taken.
 */
export const PARTIES = ["Republican", "Democratic"] as const

/** Selector order for the top-level regions; districts sort by label. */
export const CIRCUIT_ORDER = [
  "ca1",
  "ca2",
  "ca3",
  "ca4",
  "ca5",
  "ca6",
  "ca7",
  "ca8",
  "ca9",
  "ca10",
  "ca11",
  "cadc",
  "cafc",
]

/** The short label drawn above a seat block. */
const CIRCUIT_LABEL: Record<string, string> = {
  ca1: "1st",
  ca2: "2nd",
  ca3: "3rd",
  ca4: "4th",
  ca5: "5th",
  ca6: "6th",
  ca7: "7th",
  ca8: "8th",
  ca9: "9th",
  ca10: "10th",
  ca11: "11th",
  cadc: "DC",
  cafc: "Fed",
  cit: "CIT",
  uscfc: "CFC",
  scotus: "SCOTUS",
}

/**
 * The Supreme Court has no territory, so upstream publishes no seat block for it. This is
 * where its own goes, in national map units — a fallback, since the profile's cluster places
 * the courts with no territory against the frame.
 */
const SCOTUS_ANCHOR: [number, number] = [2029097, -25000]

/** Where a court's seat block is drawn, in the units of the map it is drawn on. */
const anchorFor = (courtId: string): number[] | undefined =>
  (ANCHORS as Record<string, number[]>)[courtId]

/** "CC BY-SA 4.0 — credit: Jane Doe" → { license, credit }; public domain carries no credit. */
export function splitLicense(license: string | null): {
  license: string | null
  credit: string | null
} {
  if (!license) return { license: null, credit: null }
  const [lic, credit] = license.split(/\s+—\s+credit:\s*/)
  return { license: (lic ?? license).trim(), credit: credit?.trim() || null }
}

function cleanPhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    u.search = ""
    return u.href
  } catch {
    return url
  }
}

/**
 * The boilerplate every appellate and district court's official name opens with. It is the
 * same 29 characters on 107 of the 110 courts, so it identifies none of them.
 */
const COURT_PREFIX = /^U\.S\. (?:Court of Appeals|District Court) for the /

/**
 * The short name used everywhere but the pane's own heading — the rail, the trail, a tooltip.
 * Neither name upstream publishes fits those: `short_name` is a citation abbreviation only a
 * lawyer reads at a glance, and `court_name` says "U.S. District Court for the" ninety-four
 * times down one column. Dropping that opening leaves the court named in words; the full title
 * still greets the reader once they open it, as the pane's `heading` fact.
 */
function regionLabel(court: Court): string {
  return court.court_name.replace(COURT_PREFIX, "").trim() || court.short_name
}

function tenureLabel(t: Court["tenure_type"]): string {
  return t === "life_tenured"
    ? "Life tenure"
    : t === "fixed_term"
      ? "Fixed term"
      : "Fixed term with senior status"
}

/**
 * How a court's bench is counted. Upstream publishes this arithmetic per court in
 * `seat_blocks.json` and tiers it as portable, so it is used rather than redone: a handful of
 * district courts seat more active judges than they are authorized, because roving judgeships
 * are shared across a state, so "authorized minus active" is not the vacancy count.
 *
 * `senior` is not in their blocks and is counted from the judge rows; so is a court with no
 * block at all, which is the Supreme Court.
 */
interface SeatCounts {
  /** Squares to draw: the active bench plus its vacancies, which can exceed `authorized`. */
  seats: number
  authorized: number
  active: number
  senior: number
  vacant: number
  r: number
  d: number
  o: number
}

function countsFor(court: Court, block: SeatBlock | undefined, judges: Judge[]): SeatCounts {
  const senior = judges.filter((j) => j.status === "senior").length
  if (block) {
    return {
      seats: block.total,
      authorized: block.authorized,
      active: block.r + block.d + block.o,
      senior,
      vacant: block.vacancies,
      r: block.r,
      d: block.d,
      o: block.o,
    }
  }
  const active = judges.filter((j) => j.status === "active")
  const authorized = court.authorized_judgeships ?? 0
  const by = (party: string): number => active.filter((j) => j.president_party === party).length
  const [republican, democratic] = PARTIES
  return {
    seats: Math.max(authorized, active.length),
    authorized,
    active: active.length,
    senior,
    vacant: Math.max(0, authorized - active.length),
    r: by(republican),
    d: by(democratic),
    o: active.length - by(republican) - by(democratic),
  }
}

// Tenure gets its own `tenure` fact too (for anything that reads facts one at a time), but as
// a line in the pane it only ever appeared beside this one — same court, same breath. Folding
// it in here instead removes that second line without losing the information.
function summaryFor(court: Court, counts: SeatCounts): string {
  const parts: string[] = []
  parts.push(`${counts.authorized} authorized`)
  parts.push(
    court.tenure_type === "fixed_term" ? `${counts.active} sitting` : `${counts.active} active`,
  )
  if (court.tenure_type !== "fixed_term" && court.court_level !== "scotus")
    parts.push(`${counts.senior} senior`)
  // A full bench is the unremarkable case, and "0 vacant" spends the tooltip's one line on it.
  if (counts.vacant > 0) parts.push(`${counts.vacant} vacant`)
  parts.push(tenureLabel(court.tenure_type))
  return parts.join(" · ")
}

/** The majority/en banc explainers, verbatim from upstream's pane (they cite statute). */
function notesFor(court: Court): { note?: string; noteSeats?: string } {
  if (court.court_level === "scotus") return {}
  if (court.court_level === "circuit")
    return {
      noteSeats:
        "Majority is computed over active judgeships by default. Senior judges are supernumerary and generally do not vote en banc.",
    }
  if (court.court_id === "uscfc")
    return {
      noteSeats:
        "This court does not sit en banc, and its judges serve 15-year terms. Senior judges serve at the discretion of the president-designated chief judge (28 U.S.C. § 797(b)), so only the active senior judges are shown.",
    }
  if (court.court_id === "cit")
    return {
      noteSeats:
        "This court does not sit en banc; select cases may instead be heard by a three-judge panel the chief judge designates (28 U.S.C. § 255). Senior judges are supernumerary.",
    }
  if (court.tenure_type === "fixed_term")
    return {
      note: "The territorial district courts do not sit en banc, and their judges serve 10-year terms. Judges can serve as “holdovers” if no successor is confirmed by the end of their term.",
    }
  return {
    noteSeats:
      "Majority is computed over active judgeships by default. Senior judges are supernumerary. The district courts do not usually vote en banc.",
  }
}

export function factsFor(
  court: Court,
  block: SeatBlock | undefined,
  judges: Judge[],
): Record<string, string> {
  const facts: Record<string, string> = {}
  facts.heading = court.court_name
  facts.tenure = tenureLabel(court.tenure_type)
  const counts = countsFor(court, block, judges)
  facts.seats = String(counts.seats)
  facts.authorized = String(counts.authorized)
  facts.active = String(counts.active)
  if (court.tenure_type !== "fixed_term" && court.court_level !== "scotus")
    facts.senior = String(counts.senior)
  facts.vacant = String(counts.vacant)
  facts["seats-r"] = String(counts.r)
  facts["seats-o"] = String(counts.o)
  facts["seats-d"] = String(counts.d)
  // Circuit and feeder anchors are in national units, district anchors in the circuit's own.
  // A region is drawn as a block in exactly one view, so one anchor suffices. Placement is
  // ours: `geometry/anchors.json`, checked in beside the geometry it is measured against.
  const anchor = court.court_level === "scotus" ? SCOTUS_ANCHOR : anchorFor(court.court_id)
  if (anchor) facts.anchor = anchor.join(",")
  const short = CIRCUIT_LABEL[court.court_id]
  if (short) facts["short-label"] = short
  facts.summary = summaryFor(court, counts)
  if (court.court_level === "circuit")
    facts["children-label"] = court.court_id === "cafc" ? "feeders" : "districts"
  const order = court.court_level === "scotus" ? 0 : CIRCUIT_ORDER.indexOf(court.court_id) + 1
  if (order > 0 || court.court_level === "scotus") facts.order = String(order)
  const notes = notesFor(court)
  if (notes.note) facts.note = notes.note
  if (notes.noteSeats) facts["note-seats"] = notes.noteSeats
  return facts
}

export function judgeRecord(j: Judge, court: Court): DrilldownRecord {
  const { license, credit } = splitLicense(j.photo_license)
  const fixed = court.tenure_type === "fixed_term" || court.tenure_type === "fixed_term_senior"
  const showsTerm = fixed && !!j.term_expiration_date && j.status !== "senior"
  return {
    _region: j.court_id,
    _id: j.seat_id ?? (j.cl_person_id !== null ? `cl${j.cl_person_id}` : j.full_name),
    full_name: j.full_name,
    display_name: j.display_name,
    status: j.status,
    appointing_president: j.appointing_president,
    president_party: j.president_party,
    confirmation_date: j.confirmation_date,
    commission_date: j.commission_date,
    senior_date: j.senior_date,
    term_expiration_date: j.term_expiration_date,
    shows_term: showsTerm,
    jd: j.jd_school ? `${j.jd_school}${j.jd_year ? ` (${j.jd_year})` : ""}` : null,
    aba_rating: j.aba_rating,
    cl_profile_url: j.cl_profile_url,
    photo_url: cleanPhotoUrl(j.photo_url),
    photo_source: j.photo_source,
    photo_license: license,
    photo_credit: credit,
    is_chief: j.is_chief,
    fedsoc_reported: j.fedsoc_reported,
    fedsoc_basis: j.fedsoc_basis,
    fedsoc_source: j.fedsoc_source,
    acs_reported: j.acs_reported,
    acs_basis: j.acs_basis,
    acs_source: j.acs_source,
  }
}

const surname = (name: string): string => {
  const parts = name
    .replace(/,/g, "")
    .trim()
    .split(/\s+/)
    .filter((p) => !/^(Jr|Sr|II|III|IV|V)\.?$/i.test(p))
  return parts[parts.length - 1] ?? name
}

const nameTokens = (s: string): string[] =>
  s
    .replace(/[.,]/g, "")
    .replace(/\b(Jr|Sr|II|III|IV)\b/gi, "")
    .trim()
    .split(/\s+/)

/**
 * A Circuit Justice sits beside a circuit's bench as an associate. The allotment rows carry
 * only name, circuit and photo, so the full Supreme Court record is merged in by surname and
 * first initial to fill the docked detail.
 */
export function justiceRecord(
  jz: Justice,
  scotus: Judge[],
  scotusCourt: Court | undefined,
): DrilldownRecord {
  const jn = nameTokens(jz.justice_name)
  const match = scotus.find((r) => {
    const p = nameTokens(r.full_name)
    return (
      p[p.length - 1]?.toLowerCase() === jn[jn.length - 1]?.toLowerCase() &&
      p[0]?.[0]?.toLowerCase() === jn[0]?.[0]?.toLowerCase()
    )
  })
  const base = match && scotusCourt ? judgeRecord(match, scotusCourt) : {}
  const { license, credit } = splitLicense(jz.photo_license)
  return {
    ...base,
    _region: jz.circuit_id,
    _role: "associate",
    _id: `justice-${jz.circuit_id}`,
    full_name: jz.justice_name,
    display_name: `Circ. Justice ${surname(jz.justice_name)}`,
    // The Chief Justice is not the chief of the circuit bench he appears over.
    is_chief: false,
    photo_url:
      cleanPhotoUrl(jz.photo_url) ?? (base as { photo_url?: string | null }).photo_url ?? null,
    photo_source:
      jz.photo_source ?? (base as { photo_source?: string | null }).photo_source ?? null,
    photo_license: license ?? (base as { photo_license?: string | null }).photo_license ?? null,
    photo_credit: credit ?? (base as { photo_credit?: string | null }).photo_credit ?? null,
  }
}

export function adaptCourtTracker(
  { raw, version, generatedAt }: FeedSnapshot<CourtTrackerSources>,
  { ref }: { ref: string },
): DrilldownData {
  const courtById = new Map(raw.courts.map((c) => [c.court_id, c]))
  const judgesByCourt = new Map<string, Judge[]>()
  for (const bundle of Object.values(raw.judges))
    for (const j of bundle) {
      const list = judgesByCourt.get(j.court_id)
      if (list) list.push(j)
      else judgesByCourt.set(j.court_id, [j])
    }

  const regions: DeclaredRegion[] = raw.courts.map((court) => ({
    id: court.court_id,
    label: regionLabel(court),
    ...(court.parent_id ? { parentId: court.parent_id } : {}),
    facts: factsFor(court, raw.seatBlocks[court.court_id], judgesByCourt.get(court.court_id) ?? []),
  }))

  const scotusCourt = courtById.get("scotus")
  const scotusJudges = raw.judges.scotus ?? []
  const records: DrilldownRecord[] = [
    ...raw.justices.map((jz) => justiceRecord(jz, scotusJudges, scotusCourt)),
    ...Object.values(raw.judges).flatMap((bundle) =>
      bundle.map((j) => {
        const court = courtById.get(j.court_id)
        if (!court) throw new Error(`judge ${j.full_name} sits on unknown court "${j.court_id}"`)
        return judgeRecord(j, court)
      }),
    ),
  ]

  const datasets: Record<string, unknown> = {}
  if (raw.presidents) datasets.presidents = raw.presidents
  // Folded here rather than kept as rows: the rows only move when upstream rebuilds.
  const appointments = aggregateAppointments(raw.appointments, PARTIES)
  if (appointments) datasets.appointments = appointments

  // What the manifest states about its own build, rather than a second implementation of
  // upstream's arithmetic free to drift from theirs.
  const upstream: Record<string, unknown> = {}
  if (raw.manifest.last_appointment) upstream.last_appointment = raw.manifest.last_appointment
  if (raw.manifest.national_totals) upstream.national_totals = raw.manifest.national_totals
  if (Object.keys(upstream).length > 0) datasets.upstream = upstream

  return {
    schema: DRILLDOWN_DATA_SCHEMA,
    generatedAt,
    source: { name: "court-tracker", version, ref },
    regions,
    records,
    ...(Object.keys(datasets).length > 0 ? { datasets } : {}),
  }
}
