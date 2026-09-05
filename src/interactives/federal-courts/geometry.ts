import type { DrilldownGeometry, GeometryFile } from "../types"

/**
 * The circuit and district shapes, pre-parsed by `scripts/snapshot-federal-courts.ts` from
 * court-tracker's QGIS export. Checked in as JSON so the page imports geometry like any other
 * module — no filesystem reads, nothing for the standalone build to trace — and loaded lazily
 * because it is megabytes the sync job never needs.
 *
 * The Federal Circuit has no districts: it is drillable (its feeders list in the selector)
 * but carries no geometry, so its entry is null.
 */
const CIRCUITS = [
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
] as const

// Static import paths so the bundler can see every file; the JSON module type is looser
// than GeometryFile (arrays, not tuples), hence the cast.
const circuitLoaders: Record<(typeof CIRCUITS)[number], () => Promise<{ default: unknown }>> = {
  ca1: () => import("./geometry/circuits/ca1.json"),
  ca2: () => import("./geometry/circuits/ca2.json"),
  ca3: () => import("./geometry/circuits/ca3.json"),
  ca4: () => import("./geometry/circuits/ca4.json"),
  ca5: () => import("./geometry/circuits/ca5.json"),
  ca6: () => import("./geometry/circuits/ca6.json"),
  ca7: () => import("./geometry/circuits/ca7.json"),
  ca8: () => import("./geometry/circuits/ca8.json"),
  ca9: () => import("./geometry/circuits/ca9.json"),
  ca10: () => import("./geometry/circuits/ca10.json"),
  ca11: () => import("./geometry/circuits/ca11.json"),
  cadc: () => import("./geometry/circuits/cadc.json"),
}

let cached: Promise<DrilldownGeometry> | null = null

export function loadFederalCourtsGeometry(): Promise<DrilldownGeometry> {
  cached ??= (async () => {
    const [overview, ...circuits] = await Promise.all([
      import("./geometry/national.json").then((m) => m.default as unknown as GeometryFile),
      ...CIRCUITS.map((id) => circuitLoaders[id]().then((m) => m.default as GeometryFile)),
    ])
    const children: DrilldownGeometry["children"] = {}
    CIRCUITS.forEach((id, i) => {
      children[id] = circuits[i]!
    })
    children.cafc = null
    return { overview, children }
  })()
  return cached
}
