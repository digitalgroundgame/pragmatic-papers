import { assetKeyFor } from "@/blocks/InteractiveMap/drilldown/records"
import { buildRegionIndex } from "@/blocks/InteractiveMap/drilldown/regions"
import {
  DRILLDOWN_SCHEMA,
  type ChildAssetRef,
  type DeclaredRegion,
  type DrilldownAsset,
  type DrilldownPath,
  type RegionIndex,
} from "@/blocks/InteractiveMap/drilldown/types"

import type { DrilldownData, DrilldownGeometry, DrilldownPresentation, GeometryFile } from "./types"

/**
 * Where the ownership rule is enforced.
 *
 * The engine renders `DrilldownAsset`s. These functions build them from the three sources —
 * code geometry, code presentation, synced data — and are the only place the three meet.
 * `facts`, `seats` and `records.display` are taken from `presentation` and from nothing else;
 * path facts are emptied so nothing baked into a geometry file leaks through either. A feed
 * that carries a `display` block, or geometry with `data-color` on a path, changes nothing.
 */

export interface ComposeInput {
  presentation: DrilldownPresentation
  geometry: DrilldownGeometry
  data: DrilldownData
}

/** Structural attributes only — every fact a reader sees comes from the data. */
function geometryPaths(file: GeometryFile | null): DrilldownPath[] {
  return file ? file.paths.map((p) => ({ ...p, facts: {} })) : []
}

/** Region ids that have a child asset — the ones a reader can drill into. */
export function childKeys(geometry: DrilldownGeometry): string[] {
  return Object.keys(geometry.children)
}

/**
 * The full hierarchy as the client will see it once every child is loaded: overview paths,
 * every child's paths, and every declared region. Used to bucket records by the child asset
 * that covers them, with the same `assetKeyFor` walk the client uses to look them up.
 */
export function composeIndex({ geometry, data }: Omit<ComposeInput, "presentation">): RegionIndex {
  const assets: DrilldownAsset[] = [
    {
      viewBox: geometry.overview.viewBox,
      flipY: geometry.overview.flipY,
      paths: geometryPaths(geometry.overview),
      payload: { schema: DRILLDOWN_SCHEMA, regions: data.regions },
      payloadError: null,
    },
    ...Object.values(geometry.children)
      .filter((c): c is GeometryFile => c !== null)
      .map((c) => ({
        viewBox: c.viewBox,
        flipY: c.flipY,
        paths: geometryPaths(c),
        payload: null,
        payloadError: null,
      })),
  ]
  return buildRegionIndex(assets)
}

function refsFor(geometry: DrilldownGeometry): ChildAssetRef[] {
  return childKeys(geometry).map((regionId) => ({ regionId, url: "" }))
}

/** The child asset key each record is served from, or null for the overview. */
export function bucketFor(
  regionId: string,
  index: RegionIndex,
  geometry: DrilldownGeometry,
): string | null {
  return assetKeyFor(regionId, index, refsFor(geometry))
}

export function composeOverview({ presentation, geometry, data }: ComposeInput): DrilldownAsset {
  const index = composeIndex({ geometry, data })
  const items = data.records.filter((r) => bucketFor(r._region, index, geometry) === null)
  return {
    viewBox: geometry.overview.viewBox,
    flipY: geometry.overview.flipY,
    paths: geometryPaths(geometry.overview),
    payload: {
      schema: DRILLDOWN_SCHEMA,
      regions: data.regions,
      ...(presentation.facts ? { facts: presentation.facts } : {}),
      ...(presentation.seats ? { seats: presentation.seats } : {}),
      records: { items, display: presentation.display },
    },
    payloadError: null,
  }
}

/** Declared regions in `regionId`'s subtree, so a child asset stands on its own. */
function subtreeRegions(
  regionId: string,
  index: RegionIndex,
  data: DrilldownData,
): DeclaredRegion[] {
  const inSubtree = (id: string): boolean => {
    let cur: string | null = id
    const seen = new Set<string>()
    while (cur && !seen.has(cur)) {
      if (cur === regionId) return true
      seen.add(cur)
      cur = index.byId[cur]?.parentId ?? null
    }
    return false
  }
  return data.regions.filter((r) => inSubtree(r.id))
}

/**
 * The lazily fetched asset for one drillable region: its child geometry (none for a
 * records-only region — the engine then keeps the overview on screen and lists the children
 * in the selector) plus every record it and its descendants own. Returns null for a region
 * that is not drillable, which the route turns into a 404.
 */
export function composeChild(
  { presentation, geometry, data }: ComposeInput,
  regionId: string,
): DrilldownAsset | null {
  if (!Object.prototype.hasOwnProperty.call(geometry.children, regionId)) return null
  const file = geometry.children[regionId] ?? null
  const index = composeIndex({ geometry, data })
  const items = data.records.filter((r) => bucketFor(r._region, index, geometry) === regionId)
  return {
    viewBox: file?.viewBox ?? null,
    flipY: file?.flipY ?? false,
    paths: geometryPaths(file),
    payload: {
      schema: DRILLDOWN_SCHEMA,
      regions: subtreeRegions(regionId, index, data),
      records: { items, display: presentation.display },
    },
    payloadError: null,
  }
}
