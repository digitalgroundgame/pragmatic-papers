/**
 * Bakes the Federal Court Appointment Tracker's data into Interactive Map drilldown assets.
 *
 * Reads a checkout of https://github.com/digitalgroundgame/court-tracker and writes the seed
 * fixtures under src/endpoints/seed/fixtures/federal-courts/:
 *
 *   national.svg          overview — circuit + district geometry, court facts as data-*, and a
 *                         <metadata> payload with the Circuit Justices, the Supreme Court bench
 *                         and the geometry-less regions (SCOTUS, Federal Circuit, CIT, CFC)
 *   circuits/<id>.svg     one child asset per circuit — that circuit's districts in the local
 *                         projection plus every judge of the circuit and its districts as
 *                         <metadata> records (cafc.svg carries records only: no geometry)
 *
 * This is the reference implementation of the asset contract documented in
 * .claude/skills/interactive-maps/SKILL.md, written against upstream's build_assets.py output.
 * Upstream owns the data; this script only reshapes it. Nothing in the Interactive Map block
 * knows any of the court vocabulary used here — it all lands in the assets.
 *
 * Usage:
 *   pnpm tsx scripts/bake-court-tracker-fixtures.ts --source ../court-tracker
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

interface Court {
  court_id: string
  court_name: string
  short_name: string
  court_level: "scotus" | "circuit" | "district" | "specialized"
  parent_id: string | null
  tenure_type: "life_tenured" | "fixed_term" | "fixed_term_senior"
  authorized_judgeships: number | null
  has_geography: boolean
  is_inset: boolean
  geometry_key: string | null
}

interface SeatBlock {
  level: "circuit" | "district" | "feeder"
  parent_id: string | null
  authorized: number
  total: number
  r: number
  d: number
  o: number
  vacancies: number
  anchor: [number, number] | null
  size: number | null
}

interface Judge {
  cl_person_id: number | null
  full_name: string
  display_name: string
  court_id: string
  seat_id: string | null
  status: "active" | "senior"
  appointing_president: string | null
  president_party: string | null
  confirmation_date: string | null
  commission_date: string | null
  senior_date: string | null
  term_expiration_date: string | null
  jd_school: string | null
  jd_year: number | null
  aba_rating: string | null
  cl_profile_url: string | null
  photo_url: string | null
  photo_source: string | null
  photo_license: string | null
  fedsoc_basis: string | null
  fedsoc_source: string | null
  acs_basis: string | null
  acs_source: string | null
  is_chief: boolean
  fedsoc_reported: boolean
  acs_reported: boolean
}

interface Justice {
  circuit_id: string
  justice_name: string
  full_name: string
  photo_url: string | null
  photo_source: string | null
  photo_license: string | null
  source_url: string | null
}

const SCHEMA = "pragmatic-papers/drilldown-map@1"
const COLORS = {
  Republican: "var(--map-positive-3, #e54858)",
  Democratic: "var(--map-negative-3, #2c86ed)",
  other: "var(--muted-foreground, #9aa3ad)",
}
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
const CIRCUIT_ORDER = [
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

function parseArgs(argv: string[]): { source: string; out: string } {
  let source = "../court-tracker"
  let out = path.resolve("src/endpoints/seed/fixtures/federal-courts")
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--source") source = argv[++i] ?? source
    else if (argv[i] === "--out") out = path.resolve(argv[++i] ?? out)
  }
  return { source: path.resolve(source), out }
}

const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, "utf8")) as T
const xmlText = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const xmlAttr = (s: string): string => xmlText(s).replace(/"/g, "&quot;")

/** "CC BY-SA 4.0 — credit: Jane Doe" → { license, credit }; public domain carries no credit. */
function splitLicense(license: string | null): { license: string | null; credit: string | null } {
  if (!license) return { license: null, credit: null }
  const [lic, credit] = license.split(/\s+—\s+credit:\s*/)
  return { license: (lic ?? license).trim(), credit: credit?.trim() || null }
}

function cleanPhotoUrl(url: string | null): string | null {
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

function summaryFor(court: Court, block: SeatBlock | undefined, judges: Judge[]): string {
  const authorized = court.authorized_judgeships ?? 0
  const active = judges.filter((j) => j.status === "active").length
  const senior = judges.filter((j) => j.status === "senior").length
  const vacant = Math.max(0, authorized - active)
  if (court.tenure_type === "fixed_term")
    return `Fixed-term court · ${authorized} authorized · ${active} sitting · ${vacant} vacant`
  if (court.court_level === "scotus")
    return `${authorized} authorized · ${active} active · ${vacant} vacant`
  void block
  return `${authorized} authorized · ${active} active · ${senior} senior · ${vacant} vacant`
}

/** The majority/en banc explainers, verbatim from upstream renderPane (they cite statute). */
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

interface Baked {
  facts: Record<string, string>
}

function factsFor(
  court: Court,
  block: SeatBlock | undefined,
  judges: Judge[],
  opts: { anchor: boolean; order: number | null },
): Baked["facts"] {
  const facts: Record<string, string> = {}
  facts["region-label"] = court.short_name
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
  if (opts.anchor && block?.anchor) facts.anchor = `${block.anchor[0]},${block.anchor[1]}`
  const short = CIRCUIT_LABEL[court.court_id]
  if (short) facts["short-label"] = short
  facts.summary = summaryFor(court, block, judges)
  if (court.court_level === "circuit")
    facts["children-label"] = court.court_id === "cafc" ? "feeders" : "districts"
  if (opts.order !== null) facts.order = String(opts.order)
  const notes = notesFor(court)
  if (notes.note) facts.note = notes.note
  if (notes.noteSeats) facts["note-seats"] = notes.noteSeats
  return facts
}

function factsToAttrs(facts: Record<string, string>): string {
  return Object.entries(facts)
    .map(([k, v]) => ` data-${k}="${xmlAttr(v)}"`)
    .join("")
}

/**
 * Rewrites every <path> in an upstream geometry file: `data-parent-circuit` → `data-parent-id`,
 * `data-court-id` dropped (the id already carries it), facts appended. The files are
 * machine-generated with one path per line and no nested markup, so a tag-level regex is safe.
 */
function annotateSvg(
  svg: string,
  factsById: (id: string) => Record<string, string> | null,
  metadata: unknown,
): string {
  let out = svg.replace(/<path\b([^>]*?)\/>/g, (_m, attrText: string) => {
    const attrs: [string, string][] = []
    const re = /([\w:-]+)="([^"]*)"/g
    let a: RegExpExecArray | null
    while ((a = re.exec(attrText))) attrs.push([a[1]!, a[2]!])
    const get = (k: string) => attrs.find(([n]) => n === k)?.[1]
    const id = get("id")
    const kept = attrs.filter(([n]) => n !== "data-court-id" && n !== "data-parent-circuit")
    const parent = get("data-parent-circuit")
    if (parent) kept.push(["data-parent-id", parent])
    const facts = id ? factsById(id) : null
    const attrString =
      kept.map(([n, v]) => ` ${n}="${v}"`).join("") + (facts ? factsToAttrs(facts) : "")
    return `<path${attrString}/>`
  })
  const json = xmlText(JSON.stringify(metadata))
  out = out.replace(/(<svg\b[^>]*>)/, `$1\n  <metadata>${json}</metadata>`)
  return out
}

function judgeRecord(j: Judge, court: Court): Record<string, unknown> {
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

function justiceRecord(
  jz: Justice,
  scotus: Judge[],
  scotusCourt: Court | undefined,
): Record<string, unknown> {
  // circuit_justices rows carry only name/circuit/photo; merge the full SCOTUS record by
  // surname + first initial so the docked detail is not empty.
  const norm = (s: string) =>
    s
      .replace(/[.,]/g, "")
      .replace(/\b(Jr|Sr|II|III|IV)\b/gi, "")
      .trim()
      .split(/\s+/)
  const jn = norm(jz.justice_name)
  const match = scotus.find((r) => {
    const p = norm(r.full_name)
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
    photo_url: cleanPhotoUrl(jz.photo_url) ?? base.photo_url ?? null,
    photo_source: jz.photo_source ?? base.photo_source ?? null,
    photo_license: license ?? base.photo_license ?? null,
    photo_credit: credit ?? base.photo_credit ?? null,
  }
}

const DISPLAY = {
  title: "full_name",
  shortTitle: "display_name",
  image: {
    url: "photo_url",
    source: "photo_source",
    license: "photo_license",
    credit: "photo_credit",
  },
  category: {
    field: "president_party",
    values: [
      {
        value: "Republican",
        label: "Appointed by a Republican president",
        shortLabel: "R-appointed",
        color: COLORS.Republican,
      },
      {
        value: "Democratic",
        label: "Appointed by a Democratic president",
        shortLabel: "D-appointed",
        color: COLORS.Democratic,
      },
    ],
    other: { label: "Other appointment", color: COLORS.other },
  },
  order: "commission_date",
  status: { field: "status", supernumerary: ["senior"], labels: { senior: "Senior" } },
  seatsFact: "seats",
  flags: [{ field: "is_chief", label: "Chief judge", symbol: "★" }],
  cohort: "appointing_president",
  marks: [
    { field: "fedsoc_reported", label: "FedSoc" },
    { field: "acs_reported", label: "ACS" },
  ],
  details: [
    { field: "appointing_president", label: "Appointed by" },
    {
      field: "senior_date",
      format: "date",
      label: "Senior status since",
      when: { field: "status", in: ["senior"] },
    },
    { field: "confirmation_date", format: "date", label: "Confirmed" },
    {
      field: "commission_date",
      format: "term",
      endField: "term_expiration_date",
      label: "Current term",
      when: { field: "shows_term", truthy: true },
    },
    {
      field: "commission_date",
      format: "years-since",
      label: "On the bench",
      when: { field: "shows_term", truthy: false },
    },
    { field: "jd", label: "JD" },
    { field: "aba_rating", label: "ABA rating" },
    {
      field: "fedsoc_reported",
      format: "reported",
      label: "Reported to have a Federalist Society affiliation",
      basisField: "fedsoc_basis",
      sourceField: "fedsoc_source",
    },
    {
      field: "acs_reported",
      format: "reported",
      label: "Reported to have an American Constitution Society affiliation",
      basisField: "acs_basis",
      sourceField: "acs_source",
    },
    { field: "cl_profile_url", format: "link", label: "CourtListener profile" },
  ],
}

const FACTS_CONFIG = {
  labels: {
    "full-name": "Court",
    tenure: "Tenure",
    authorized: "Authorized judgeships",
    active: "Active judges",
    senior: "Senior judges",
    vacant: "Vacancies",
  },
  order: ["full-name", "tenure", "authorized", "active", "senior", "vacant"],
  // machine inputs consumed by the seats/records configuration (also auto-hidden by the block)
  hide: ["seats", "seats-r", "seats-o", "seats-d", "anchor", "short-label"],
}

const SEATS_CONFIG = {
  totalFact: "seats",
  groups: [
    { fact: "seats-r", label: "Republican-appointed", color: COLORS.Republican },
    { fact: "seats-o", label: "Other", color: COLORS.other },
    { fact: "seats-d", label: "Democratic-appointed", color: COLORS.Democratic },
  ],
  vacant: { label: "Vacant" },
  anchorFact: "anchor",
  labelFact: "short-label",
}

function main(): number {
  const { source, out } = parseArgs(process.argv.slice(2))
  const dataDir = path.join(source, "data")
  const geoDir = path.join(source, "assets", "geo")
  for (const f of ["courts.json", "seat_blocks.json", "circuit_justices.json"]) {
    if (!existsSync(path.join(dataDir, f))) {
      console.error(`missing ${path.join(dataDir, f)} — run upstream's build_assets.py first`)
      return 1
    }
  }
  const courts = readJson<Court[]>(path.join(dataDir, "courts.json"))
  const blocks = readJson<Record<string, SeatBlock>>(path.join(dataDir, "seat_blocks.json"))
  const justices = readJson<Justice[]>(path.join(dataDir, "circuit_justices.json"))
  const courtById = new Map(courts.map((c) => [c.court_id, c]))
  const judgesByBundle = new Map<string, Judge[]>()
  for (const f of readdirSync(path.join(dataDir, "judges"))) {
    if (!f.endsWith(".json")) continue
    judgesByBundle.set(f.replace(/\.json$/, ""), readJson<Judge[]>(path.join(dataDir, "judges", f)))
  }
  const judgesByCourt = new Map<string, Judge[]>()
  for (const bundle of judgesByBundle.values())
    for (const j of bundle)
      (judgesByCourt.get(j.court_id) ?? judgesByCourt.set(j.court_id, []).get(j.court_id)!).push(j)

  mkdirSync(path.join(out, "circuits"), { recursive: true })

  // ---- overview -------------------------------------------------------------------------------
  const nationalFacts = (id: string): Record<string, string> | null => {
    const court = courtById.get(id)
    if (!court) return null
    const isCircuit = court.court_level === "circuit"
    return factsFor(court, blocks[id], judgesByCourt.get(id) ?? [], {
      anchor: isCircuit, // circuit anchors are in national units; district anchors are local
      order: isCircuit ? CIRCUIT_ORDER.indexOf(id) + 1 : null,
    })
  }
  const scotus = courtById.get("scotus")
  const declaredRegions: Record<string, unknown>[] = []
  if (scotus)
    declaredRegions.push({
      id: "scotus",
      label: "Supreme Court",
      facts: factsFor(scotus, undefined, judgesByCourt.get("scotus") ?? [], {
        anchor: false,
        order: 0,
      }),
    })
  for (const id of ["cafc", "cit", "uscfc"]) {
    const court = courtById.get(id)
    if (!court) continue
    const facts = factsFor(court, blocks[id], judgesByCourt.get(id) ?? [], {
      anchor: true, // upstream parks these blocks in open water off the 11th, in national units
      order: id === "cafc" ? CIRCUIT_ORDER.indexOf(id) + 1 : null,
    })
    declaredRegions.push({
      id,
      label: court.short_name,
      ...(court.parent_id ? { parentId: court.parent_id } : {}),
      facts,
    })
  }
  const scotusJudges = judgesByBundle.get("scotus") ?? []
  const overviewRecords = [
    ...justices.map((jz) => justiceRecord(jz, scotusJudges, scotus)),
    ...(scotus ? scotusJudges.map((j) => judgeRecord(j, scotus)) : []),
  ]
  const nationalSvg = annotateSvg(
    readFileSync(path.join(geoDir, "national.svg"), "utf8"),
    nationalFacts,
    {
      schema: SCHEMA,
      regions: declaredRegions,
      facts: FACTS_CONFIG,
      seats: SEATS_CONFIG,
      records: { items: overviewRecords, display: DISPLAY },
    },
  )
  writeFileSync(path.join(out, "national.svg"), nationalSvg)
  console.warn(
    `national.svg  ${(nationalSvg.length / 1024).toFixed(0)} KB · ${overviewRecords.length} records`,
  )

  // ---- child assets ---------------------------------------------------------------------------
  for (const circuitId of CIRCUIT_ORDER) {
    const court = courtById.get(circuitId)
    if (!court) continue
    const bundle = judgesByBundle.get(circuitId) ?? []
    const items = bundle.map((j) => judgeRecord(j, courtById.get(j.court_id) ?? court))
    const metadata = { schema: SCHEMA, records: { items, display: DISPLAY } }
    const geoFile = path.join(geoDir, "circuits", `${circuitId}.svg`)
    let svg: string
    if (existsSync(geoFile)) {
      svg = annotateSvg(
        readFileSync(geoFile, "utf8"),
        (id) => {
          const c = courtById.get(id)
          if (!c) return null
          return factsFor(c, blocks[id], judgesByCourt.get(id) ?? [], {
            anchor: c.court_level === "district", // local units
            order: null,
          })
        },
        metadata,
      )
    } else {
      // No geometry (the Federal Circuit): records only. The block keeps the overview on screen
      // and lists the children in the selector.
      svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">\n  <metadata>${xmlText(JSON.stringify(metadata))}</metadata>\n</svg>\n`
    }
    writeFileSync(path.join(out, "circuits", `${circuitId}.svg`), svg)
    console.warn(
      `circuits/${circuitId}.svg  ${(svg.length / 1024).toFixed(0)} KB · ${items.length} records`,
    )
  }
  return 0
}

process.exit(main())
