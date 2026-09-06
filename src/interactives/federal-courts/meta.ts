import { fieldString } from "@/blocks/InteractiveMap/drilldown/recordFormat"

import type { DrilldownData } from "../types"

const APPOINTMENT_DATE = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
})

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

/** The date the manifest itself states, when it states one. */
function statedDate(data: DrilldownData): string | null {
  const upstream = data.datasets?.upstream
  if (!isRecord(upstream)) return null
  const stated = upstream.last_appointment
  return typeof stated === "string" && stated !== "" ? stated : null
}

/**
 * The most recent commission in the snapshot, for the page header.
 *
 * "Data as of" says when the sync ran; a tracker that has not moved in months looks identical
 * to one that syncs nightly. This says when the judiciary last actually changed, which is the
 * number a reader came for.
 *
 * The manifest states this date itself, so that wins when present: deriving it from the rows
 * is a second implementation of upstream's arithmetic, free to disagree with theirs. The
 * derivation stays as the fallback, reading `datasets.appointments` and then the sitting
 * records.
 */
export function federalCourtsMetaLine({ data }: { data: DrilldownData }): string | null {
  const history = Array.isArray(data.datasets?.appointments) ? data.datasets.appointments : []
  const candidates: { name: string | null; when: string }[] = []

  for (const raw of history) {
    if (typeof raw !== "object" || raw === null) continue
    const row = raw as Record<string, unknown>
    const when = row.commission_date
    if (typeof when !== "string" || when === "") continue
    candidates.push({ name: typeof row.full_name === "string" ? row.full_name : null, when })
  }
  if (candidates.length === 0)
    for (const record of data.records) {
      const when = fieldString(record, "commission_date")
      if (!when) continue
      candidates.push({ name: fieldString(record, "full_name"), when })
    }
  const stated = statedDate(data)
  const latest = stated
    ? (candidates.find((c) => c.when === stated) ?? { name: null, when: stated })
    : candidates.length > 0
      ? candidates.reduce((a, b) => (b.when > a.when ? b : a))
      : null
  if (!latest) return null

  const date = new Date(`${latest.when}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return null
  const when = APPOINTMENT_DATE.format(date)
  return latest.name ? `last appointment ${latest.name}, ${when}` : `last appointment ${when}`
}
