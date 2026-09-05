import type {
  CategoryValue,
  DetailCondition,
  DetailLine,
  DrilldownRecord,
  RecordDisplay,
} from "./types"

export function fieldString(record: DrilldownRecord, field: string | undefined): string | null {
  if (!field) return null
  const v = record[field]
  if (v === null || v === undefined || v === "") return null
  if (typeof v === "string") return v
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  return null
}

export function fieldTruthy(record: DrilldownRecord, field: string | undefined): boolean {
  if (!field) return false
  const v = record[field]
  return v !== null && v !== undefined && v !== false && v !== "" && v !== 0
}

export function passesCondition(
  record: DrilldownRecord,
  when: DetailCondition | undefined,
): boolean {
  if (!when) return true
  const v = record[when.field]
  if (when.truthy !== undefined && fieldTruthy(record, when.field) !== when.truthy) return false
  if (when.in && !when.in.some((x) => x === v)) return false
  if (when.notIn && when.notIn.some((x) => x === v)) return false
  return true
}

export interface ResolvedCategory extends CategoryValue {
  isOther: boolean
}

export function categoryOf(record: DrilldownRecord, display: RecordDisplay): ResolvedCategory {
  const raw = fieldString(record, display.category.field)
  const hit = display.category.values.find((c) => c.value === raw)
  if (hit) return { ...hit, isOther: false }
  const other = display.category.other ?? { label: "Other", color: "var(--muted-foreground)" }
  return {
    value: raw ?? "",
    label: other.label,
    shortLabel: other.label,
    color: other.color,
    isOther: true,
  }
}

export function isSupernumerary(record: DrilldownRecord, display: RecordDisplay): boolean {
  const status = display.status
  if (!status?.supernumerary?.length) return false
  const v = fieldString(record, status.field)
  return v !== null && status.supernumerary.includes(v)
}

export function statusLabel(record: DrilldownRecord, display: RecordDisplay): string | null {
  const status = display.status
  if (!status) return null
  const v = fieldString(record, status.field)
  if (v === null) return null
  return status.labels?.[v] ?? null
}

/** Generational suffixes are not surnames: "Samuel A. Alito, Jr." → "Alito". */
export function surname(name: string): string {
  const parts = name
    .replace(/,/g, "")
    .trim()
    .split(/\s+/)
    .filter((p) => !/^(Jr|Sr|II|III|IV|V)\.?$/i.test(p))
  return parts[parts.length - 1] ?? name
}

export function initials(name: string | null): string {
  const clean = (name ?? "?").trim()
  const parts = clean.split(/\s+/)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? (surname(clean)[0] ?? "") : ""
  return (first + last).toUpperCase() || "?"
}

/** Sort key: ISO dates and numbers compare correctly as strings/numbers; blanks last. */
export function compareByField(field: string | undefined) {
  return (a: DrilldownRecord, b: DrilldownRecord): number => {
    if (!field) return 0
    const av = a[field]
    const bv = b[field]
    if (av === bv) return 0
    if (av === null || av === undefined || av === "") return 1
    if (bv === null || bv === undefined || bv === "") return -1
    if (typeof av === "number" && typeof bv === "number") return av - bv
    return String(av).localeCompare(String(bv))
  }
}

// ---- dates ------------------------------------------------------------------------------------

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Parses a plain `YYYY-MM-DD` at noon UTC so no local timezone can shift the calendar day. */
export function parseIsoDate(value: string | null): Date | null {
  if (!value) return null
  const m = ISO_DATE.exec(value.trim())
  if (!m) {
    const t = Date.parse(value)
    return Number.isNaN(t) ? null : new Date(t)
  }
  return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, 12))
}

export function formatDate(value: string | null): string | null {
  const d = parseIsoDate(value)
  if (!d) return value
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

export function yearsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (365.25 * 24 * 3600 * 1000)
}

export function formatYears(years: number | null): string {
  if (years === null || !Number.isFinite(years)) return "—"
  let whole = Math.floor(years)
  let months = Math.round((years - whole) * 12)
  if (months === 12) {
    whole += 1
    months = 0
  }
  return months && whole < 25 ? `${whole} yr ${months} mo` : `${whole} yr`
}

// ---- detail lines -----------------------------------------------------------------------------

export type FormattedDetail =
  | { kind: "text"; label: string | null; value: string }
  | { kind: "link"; label: string; href: string }
  | { kind: "reported"; label: string; basis: string | null; source: string | null }

export function formatDetailLine(
  line: DetailLine,
  record: DrilldownRecord,
  now: Date,
): FormattedDetail | null {
  if (!passesCondition(record, line.when)) return null
  const raw = fieldString(record, line.field)
  const label = line.label ?? null
  switch (line.format ?? "text") {
    case "text":
      return raw === null ? null : { kind: "text", label, value: raw }
    case "date": {
      const formatted = formatDate(raw)
      return formatted === null ? null : { kind: "text", label, value: formatted }
    }
    case "years-since": {
      const d = parseIsoDate(raw)
      if (!d) return null
      return { kind: "text", label, value: formatYears(yearsBetween(d, now)) }
    }
    case "term": {
      const start = parseIsoDate(raw)
      const endRaw = fieldString(record, line.endField)
      const end = parseIsoDate(endRaw)
      if (!start) return null
      const served = formatYears(yearsBetween(start, now))
      if (!end) return { kind: "text", label, value: `${served} served` }
      if (end.getTime() < now.getTime()) {
        return {
          kind: "text",
          label,
          value: `${served} served · term expired ${formatDate(endRaw)} · holding over pending a successor`,
        }
      }
      return {
        kind: "text",
        label,
        value: `${served} served · ${formatYears(yearsBetween(now, end))} remaining (expires ${formatDate(endRaw)})`,
      }
    }
    case "link":
      return raw === null ? null : { kind: "link", label: label ?? raw, href: raw }
    case "reported":
      if (!fieldTruthy(record, line.field)) return null
      return {
        kind: "reported",
        label: label ?? line.field,
        basis: fieldString(record, line.basisField),
        source: fieldString(record, line.sourceField),
      }
    default:
      return raw === null ? null : { kind: "text", label, value: raw }
  }
}

/** Only http(s) URLs may become links; anything else renders as plain text. */
export function safeHref(href: string): string | null {
  try {
    const u = new URL(href)
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null
  } catch {
    return null
  }
}
