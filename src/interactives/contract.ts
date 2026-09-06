import { validateRecordItems, validateRegions } from "@/blocks/InteractiveMap/drilldown/contract"
import type { DeclaredRegion, DrilldownRecord } from "@/blocks/InteractiveMap/drilldown/types"

import { DRILLDOWN_DATA_SCHEMA, type DrilldownData, type DrilldownGeometry } from "./types"

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)
const isString = (v: unknown): v is string => typeof v === "string"

export interface DataValidation {
  data: DrilldownData | null
  /** Human-readable, one problem per line — what the sync logs and what an editor reads. */
  errors: string[]
}

/** Region ids the geometry draws, top-level and children alike. */
export function geometryRegionIds(geometry: DrilldownGeometry): Set<string> {
  const ids = new Set<string>()
  for (const p of geometry.overview.paths) if (p.id) ids.add(p.id)
  for (const child of Object.values(geometry.children)) {
    if (!child) continue
    for (const p of child.paths) if (p.id) ids.add(p.id)
  }
  return ids
}

/**
 * Structural check of a feed, plus — when geometry is given — referential integrity: every
 * record must belong to a region that exists, and every declared parent must exist. That is
 * the check that keeps a data refresh from silently blanking the map: an upstream rename of a
 * region id fails here and the last good version keeps serving.
 *
 * Errors are reported, never thrown: the sync logs them and moves on; a CLI prints them.
 */
export function validateDrilldownData(
  input: unknown,
  geometry?: DrilldownGeometry | null,
): DataValidation {
  const errors: string[] = []
  if (!isRecord(input)) return { data: null, errors: ["data must be a JSON object"] }

  if (input.schema !== DRILLDOWN_DATA_SCHEMA) {
    errors.push(`schema must be "${DRILLDOWN_DATA_SCHEMA}" (got ${JSON.stringify(input.schema)})`)
  }
  if (!isString(input.generatedAt) || Number.isNaN(Date.parse(input.generatedAt))) {
    errors.push("generatedAt must be an ISO 8601 date")
  }
  const source = input.source
  if (!isRecord(source) || !isString(source.name) || !isString(source.version)) {
    errors.push("source needs a name and a version")
  } else if (source.ref !== undefined && !isString(source.ref)) {
    errors.push("source.ref must be a string when present")
  }

  const regions: DeclaredRegion[] =
    input.regions === undefined
      ? (errors.push("regions must be an array"), [])
      : (validateRegions(input.regions, errors) ?? [])

  const records: DrilldownRecord[] = validateRecordItems(input.records, errors, "records")

  let datasets: Record<string, unknown> | undefined
  if (input.datasets !== undefined) {
    if (!isRecord(input.datasets)) errors.push("datasets must be an object of named datasets")
    else {
      datasets = {}
      for (const [name, value] of Object.entries(input.datasets)) {
        if (!isRecord(value) && !Array.isArray(value)) {
          errors.push(`datasets.${name} must be an array or an object`)
          continue
        }
        datasets[name] = value
      }
    }
  }

  // ---- referential integrity ----------------------------------------------------------------
  const declared = new Set(regions.map((r) => r.id))
  const dupes = regions.map((r) => r.id).filter((id, i, all) => all.indexOf(id) !== i)
  for (const id of new Set(dupes)) errors.push(`regions declares "${id}" more than once`)

  if (geometry) {
    const drawn = geometryRegionIds(geometry)
    const known = new Set([...drawn, ...declared])
    for (const r of regions) {
      if (r.parentId && !known.has(r.parentId))
        errors.push(`region "${r.id}" names parent "${r.parentId}", which is not a region`)
      // A region with no shape under a parent that has one is how an upstream rename shows
      // up: the shape keeps the old id with nothing attached, the new id floats beside it.
      // Regions with no shape are expected only at the top level or under a parent that
      // also has none (a court's non-geographic feeders).
      else if (r.parentId && !drawn.has(r.id) && drawn.has(r.parentId))
        errors.push(
          `region "${r.id}" has no geometry but its parent "${r.parentId}" is drawn — was a region renamed upstream?`,
        )
    }
    // A drawn shape the feed never mentions renders with no facts and no records.
    for (const id of drawn)
      if (!declared.has(id))
        errors.push(`geometry draws "${id}" but the feed declares no such region`)
    const missing = new Map<string, number>()
    for (const rec of records) {
      if (!known.has(rec._region)) missing.set(rec._region, (missing.get(rec._region) ?? 0) + 1)
    }
    for (const [id, n] of missing)
      errors.push(`${n} record${n === 1 ? "" : "s"} belong to "${id}", which is not a region`)
  }

  if (errors.length > 0) return { data: null, errors }
  const src = source as { name: string; version: string; ref?: string }
  const data: DrilldownData = {
    schema: DRILLDOWN_DATA_SCHEMA,
    generatedAt: input.generatedAt as string,
    source: src.ref === undefined ? { name: src.name, version: src.version } : { ...src },
    regions,
    records,
  }
  if (datasets) data.datasets = datasets
  return { data, errors }
}
