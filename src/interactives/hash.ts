import { createHash } from "node:crypto"

import type { DrilldownData } from "./types"

/** JSON with object keys sorted at every level, so equal data hashes equal. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (typeof v !== "object" || v === null || Array.isArray(v)) return v
    const sorted: Record<string, unknown> = {}
    for (const k of Object.keys(v as Record<string, unknown>).sort())
      sorted[k] = (v as Record<string, unknown>)[k]
    return sorted
  })
}

/**
 * Content hash of a feed. Upstream's version stamp says "their build changed"; this says
 * "what we render changed" — a geometry-only upstream commit, or a rebuild that only bumped
 * the timestamp, moves the first but not the second, and the sync writes a new version only
 * when the second moves. Provenance (`source`, `generatedAt`) is therefore left out.
 */
export function hashDrilldownData(
  data: Pick<DrilldownData, "regions" | "records"> & Partial<Pick<DrilldownData, "datasets">>,
): string {
  const rendered = { regions: data.regions, records: data.records, datasets: data.datasets }
  return createHash("sha256").update(stableStringify(rendered)).digest("hex").slice(0, 16)
}
