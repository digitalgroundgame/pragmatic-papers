import {
  DRILLDOWN_SCHEMA,
  type DeclaredRegion,
  type DrilldownPayload,
  type DrilldownRecord,
  type FactMap,
  type LookupEntry,
  type RecordDisplay,
  type RegionNote,
} from "./types"

/** `data-*` keys (without the prefix) that carry structure or reserved display slots. */
export const RESERVED_FACTS = {
  label: "region-label",
  parentId: "parent-id",
  layer: "layer",
  inset: "inset",
  childrenLabel: "children-label",
  order: "order",
  summary: "summary",
  note: "note",
} as const

const RESERVED_SET = new Set<string>(Object.values(RESERVED_FACTS))

export function isReservedFact(key: string): boolean {
  return RESERVED_SET.has(key) || key.startsWith(`${RESERVED_FACTS.note}-`)
}

/** Accepts `data-seats` or `seats`; returns the bare key the fact maps use. */
export function factKey(name: string): string {
  return name.toLowerCase().replace(/^data-/, "")
}

/** `active-count` → `Active count`. */
export function humanizeFactKey(key: string): string {
  const words = key.replace(/[-_]+/g, " ").trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Splits the notes out of a fact map: `note` shows always, `note-seats` in seat-chart mode. */
export function notesFromFacts(facts: FactMap): RegionNote[] {
  const notes: RegionNote[] = []
  for (const [key, text] of Object.entries(facts)) {
    if (!text.trim()) continue
    if (key === RESERVED_FACTS.note) notes.push({ text, mode: "always" })
    else if (key === `${RESERVED_FACTS.note}-seats`) notes.push({ text, mode: "seats" })
  }
  return notes
}

// ---- payload validation -------------------------------------------------------------------

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)
const isString = (v: unknown): v is string => typeof v === "string"
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isString)
const isStringMap = (v: unknown): v is Record<string, string> =>
  isRecord(v) && Object.values(v).every(isString)

function normalizeFactKeys(map: Record<string, string>): FactMap {
  const out: FactMap = {}
  for (const [k, v] of Object.entries(map)) out[factKey(k)] = v
  return out
}

export function validateRegions(v: unknown, errors: string[]): DeclaredRegion[] | undefined {
  if (v === undefined) return undefined
  if (!Array.isArray(v)) {
    errors.push("regions must be an array")
    return undefined
  }
  const out: DeclaredRegion[] = []
  v.forEach((r, i) => {
    if (!isRecord(r) || !isString(r.id) || !r.id) {
      errors.push(`regions[${i}] needs a string id`)
      return
    }
    const region: DeclaredRegion = { id: r.id }
    if (isString(r.label)) region.label = r.label
    if (isString(r.parentId)) region.parentId = r.parentId
    if (r.facts !== undefined) {
      if (isStringMap(r.facts)) region.facts = normalizeFactKeys(r.facts)
      else errors.push(`regions[${i}].facts must map strings to strings`)
    }
    out.push(region)
  })
  return out
}

function validateDisplay(v: unknown, errors: string[]): RecordDisplay | null {
  if (!isRecord(v)) {
    errors.push("records.display must be an object")
    return null
  }
  if (!isString(v.title)) errors.push("records.display.title must name a field")
  const cat = v.category
  if (
    !isRecord(cat) ||
    !isString(cat.field) ||
    !Array.isArray(cat.values) ||
    !cat.values.every(
      (c) => isRecord(c) && isString(c.value) && isString(c.label) && isString(c.color),
    )
  ) {
    errors.push("records.display.category needs a field and values[{value,label,color}]")
  }
  if (!Array.isArray(v.details) || !v.details.every((d) => isRecord(d) && isString(d.field))) {
    errors.push("records.display.details must be an array of {field, …}")
  }
  if (errors.length > 0) return null
  const display = v as unknown as RecordDisplay
  if (display.seatsFact) display.seatsFact = factKey(display.seatsFact)
  return display
}

/** Checks a list of records; `path` names the list in error messages. */
export function validateRecordItems(v: unknown, errors: string[], path: string): DrilldownRecord[] {
  if (!Array.isArray(v)) {
    errors.push(`${path} must be an array`)
    return []
  }
  const items: DrilldownRecord[] = []
  v.forEach((item, i) => {
    if (!isRecord(item) || !isString(item._region) || !item._region) {
      errors.push(`${path}[${i}] needs a string _region`)
      return
    }
    if (item._role !== undefined && item._role !== "seat" && item._role !== "associate") {
      errors.push(`${path}[${i}]._role must be "seat" or "associate"`)
      return
    }
    items.push(item as DrilldownRecord)
  })
  return items
}

function validateRecords(
  v: unknown,
  errors: string[],
): { items: DrilldownRecord[]; display: RecordDisplay } | undefined {
  if (v === undefined) return undefined
  if (!isRecord(v)) {
    errors.push("records must be an object")
    return undefined
  }
  if (!Array.isArray(v.items)) {
    errors.push("records.items must be an array")
    return undefined
  }
  const items = validateRecordItems(v.items, errors, "records.items")
  const display = validateDisplay(v.display, errors)
  if (!display) return undefined
  return { items, display }
}

export interface PayloadValidation {
  payload: DrilldownPayload | null
  errors: string[]
}

/**
 * Checks the decoded `<metadata>` JSON against the contract. Structural mistakes are
 * reported rather than thrown so a bad upload degrades to "no records" at render time
 * and to a readable list in the validator script.
 */
/** Side tables for `portrait` detail lines. Unknown entry fields are dropped, not rejected. */
function validateLookups(
  input: unknown,
  errors: string[],
): DrilldownPayload["lookups"] | undefined {
  if (input === undefined) return undefined
  if (!isRecord(input)) {
    errors.push("lookups must be an object of tables")
    return undefined
  }
  const out: NonNullable<DrilldownPayload["lookups"]> = {}
  for (const [name, table] of Object.entries(input)) {
    if (!isRecord(table)) {
      errors.push(`lookups.${name} must be an object keyed by value`)
      continue
    }
    const rows: Record<string, LookupEntry> = {}
    for (const [key, entry] of Object.entries(table)) {
      if (!isRecord(entry)) continue
      const row: LookupEntry = {}
      if (isString(entry.image)) row.image = entry.image
      if (isString(entry.label)) row.label = entry.label
      if (isString(entry.source)) row.source = entry.source
      if (Object.keys(row).length > 0) rows[key] = row
    }
    if (Object.keys(rows).length > 0) out[name] = rows
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export function validateDrilldownPayload(input: unknown): PayloadValidation {
  const errors: string[] = []
  if (!isRecord(input)) return { payload: null, errors: ["payload must be a JSON object"] }
  if (input.schema !== DRILLDOWN_SCHEMA) {
    errors.push(`schema must be "${DRILLDOWN_SCHEMA}" (got ${JSON.stringify(input.schema)})`)
  }

  const regions = validateRegions(input.regions, errors)

  let facts: DrilldownPayload["facts"]
  if (input.facts !== undefined) {
    if (!isRecord(input.facts)) errors.push("facts must be an object")
    else {
      facts = {}
      if (input.facts.labels !== undefined) {
        if (isStringMap(input.facts.labels)) facts.labels = normalizeFactKeys(input.facts.labels)
        else errors.push("facts.labels must map fact keys to strings")
      }
      if (input.facts.hide !== undefined) {
        if (isStringArray(input.facts.hide)) facts.hide = input.facts.hide.map(factKey)
        else errors.push("facts.hide must be an array of fact keys")
      }
      if (input.facts.order !== undefined) {
        if (isStringArray(input.facts.order)) facts.order = input.facts.order.map(factKey)
        else errors.push("facts.order must be an array of fact keys")
      }
    }
  }

  let seats: DrilldownPayload["seats"]
  if (input.seats !== undefined) {
    const s = input.seats
    if (
      !isRecord(s) ||
      !isString(s.totalFact) ||
      !Array.isArray(s.groups) ||
      !s.groups.every(
        (g) => isRecord(g) && isString(g.fact) && isString(g.label) && isString(g.color),
      )
    ) {
      errors.push("seats needs totalFact and groups[{fact,label,color}]")
    } else {
      seats = {
        totalFact: factKey(s.totalFact),
        groups: (s.groups as { fact: string; label: string; color: string }[]).map((g) => ({
          ...g,
          fact: factKey(g.fact),
        })),
      }
      if (isRecord(s.vacant) && isString(s.vacant.label)) seats.vacant = { label: s.vacant.label }
      if (isString(s.anchorFact)) seats.anchorFact = factKey(s.anchorFact)
      if (isString(s.labelFact)) seats.labelFact = factKey(s.labelFact)
    }
  }

  const records = validateRecords(input.records, errors)
  const lookups = validateLookups(input.lookups, errors)

  if (errors.length > 0) return { payload: null, errors }
  const payload: DrilldownPayload = { schema: DRILLDOWN_SCHEMA }
  if (regions) payload.regions = regions
  if (facts) payload.facts = facts
  if (seats) payload.seats = seats
  if (records) payload.records = records
  if (lookups) payload.lookups = lookups
  return { payload, errors }
}
