import type { DeclaredRegion, DrilldownRecord } from "@/blocks/InteractiveMap/drilldown/types"

import { DRILLDOWN_DATA_SCHEMA, type DrilldownData, type FeedSnapshot } from "../types"
import type { Appointment, Court, CourtTrackerSources, Judge, Justice, SeatBlock } from "./upstream"

/**
 * court-tracker → drilldown data. Pragmatic Papers owns this file: it absorbs upstream's
 * shape so the researcher's only obligation is to keep publishing what they already publish.
 *
 * Everything here is a value or a meaning — counts, dates, names, which party appointed
 * whom, the statutory explainer a court's pane cites. Nothing here is appearance; that is
 * `presentation.ts`.
 */

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
}

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

function tenureLabel(t: Court["tenure_type"]): string {
  return t === "life_tenured"
    ? "Life tenure"
    : t === "fixed_term"
      ? "Fixed term"
      : "Fixed term with senior status"
}

function summaryFor(court: Court, judges: Judge[]): string {
  const authorized = court.authorized_judgeships ?? 0
  const active = judges.filter((j) => j.status === "active").length
  const senior = judges.filter((j) => j.status === "senior").length
  const vacant = Math.max(0, authorized - active)
  if (court.tenure_type === "fixed_term")
    return `Fixed-term court · ${authorized} authorized · ${active} sitting · ${vacant} vacant`
  if (court.court_level === "scotus")
    return `${authorized} authorized · ${active} active · ${vacant} vacant`
  return `${authorized} authorized · ${active} active · ${senior} senior · ${vacant} vacant`
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
  facts["full-name"] = court.court_name
  facts.tenure = tenureLabel(court.tenure_type)
  const authorized = court.authorized_judgeships ?? 0
  const active = judges.filter((j) => j.status === "active")
  const senior = judges.filter((j) => j.status === "senior")
  facts.seats = String(Math.max(authorized, active.length))
  facts.authorized = String(authorized)
  facts.active = String(active.length)
  if (court.tenure_type !== "fixed_term" && court.court_level !== "scotus")
    facts.senior = String(senior.length)
  facts.vacant = String(Math.max(0, authorized - active.length))
  facts["seats-r"] = String(active.filter((j) => j.president_party === "Republican").length)
  facts["seats-o"] = String(
    active.filter((j) => j.president_party !== "Republican" && j.president_party !== "Democratic")
      .length,
  )
  facts["seats-d"] = String(active.filter((j) => j.president_party === "Democratic").length)
  // Circuit and feeder anchors are in national units; district anchors in the circuit's local
  // units. A region is drawn as a block in exactly one of the two views, so one anchor suffices.
  if (court.court_level !== "scotus" && block?.anchor)
    facts.anchor = `${block.anchor[0]},${block.anchor[1]}`
  const short = CIRCUIT_LABEL[court.court_id]
  if (short) facts["short-label"] = short
  facts.summary = summaryFor(court, judges)
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
    photo_thumb: j.photo_thumb ?? null,
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
    full_name: jz.full_name || jz.justice_name,
    display_name: `Circ. Justice ${surname(jz.justice_name)}`,
    // The Chief Justice is not the chief of the circuit bench he appears over.
    is_chief: false,
    photo_url:
      cleanPhotoUrl(jz.photo_url) ?? (base as { photo_url?: string | null }).photo_url ?? null,
    photo_thumb: jz.photo_thumb ?? (base as { photo_thumb?: string | null }).photo_thumb ?? null,
    photo_source:
      jz.photo_source ?? (base as { photo_source?: string | null }).photo_source ?? null,
    photo_license: license ?? (base as { photo_license?: string | null }).photo_license ?? null,
    photo_credit: credit ?? (base as { photo_credit?: string | null }).photo_credit ?? null,
  }
}

/** The fields the Change view and the appointments timeline read; the rest is dropped. */
export function compactAppointment(a: Appointment): Record<string, unknown> {
  return {
    full_name: a.full_name,
    court_id: a.court_id,
    court_level: a.court_level,
    appointing_president: a.appointing_president,
    president_party: a.president_party,
    confirmation_date: a.confirmation_date || null,
    commission_date: a.commission_date || null,
    senior_date: a.senior_date || null,
    termination_date: a.termination_date || null,
    termination_reason: a.termination_reason || null,
    sitting: a.sitting === "true",
    fedsoc_reported: a.fedsoc_reported === "true",
    acs_reported: a.acs_reported === "true",
    photo_thumb: a.photo_thumb ?? null,
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
    label: court.short_name,
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
  if (raw.arrangement) datasets.arrangement = raw.arrangement
  if (raw.appointments) datasets.appointments = raw.appointments.map(compactAppointment)

  return {
    schema: DRILLDOWN_DATA_SCHEMA,
    generatedAt,
    source: { name: "court-tracker", version, ref },
    regions,
    records,
    ...(Object.keys(datasets).length > 0 ? { datasets } : {}),
  }
}
