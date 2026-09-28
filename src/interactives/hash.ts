import { createHash } from "node:crypto"

import type { DrilldownData, DrilldownGeometry, DrilldownPresentation, GeometryFile } from "./types"

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

/**
 * Content hash of one region's geometry, which moves only when the map is reprojected. It goes
 * in the URL, so that URL can be cached forever and a reprojection issues a new one.
 */
const geometryHashes = new WeakMap<GeometryFile, string>()

export function geometryHash(file: GeometryFile | null): string {
  if (!file) return "none"
  const cached = geometryHashes.get(file)
  if (cached) return cached
  const hash = createHash("sha256").update(stableStringify(file)).digest("hex").slice(0, 12)
  geometryHashes.set(file, hash)
  return hash
}

/**
 * Bumped when the composed output changes shape for a reason the profile cannot see — a new
 * field in the search index, say. Everything else in the fingerprint is what a profile
 * declares, so without this a composer change leaves every cached route serving the old shape.
 */
const COMPOSE_VERSION = 3

/**
 * What a profile's *code* contributes to a composed asset: its presentation, its geometry and
 * the shape the composer builds out of them. It belongs in the cache key because the composed
 * asset mixes code and data, and the tag on it only knows about the data — without it,
 * changing a label served the old one until an editor happened to publish something.
 */
export function profileFingerprint(
  presentation: DrilldownPresentation,
  geometry: DrilldownGeometry,
): string {
  const parts = [
    `v${COMPOSE_VERSION}`,
    stableStringify(presentation),
    geometryHash(geometry.overview),
    ...Object.keys(geometry.children)
      .sort()
      .map((id) => `${id}:${geometryHash(geometry.children[id] ?? null)}`),
  ]
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 12)
}
