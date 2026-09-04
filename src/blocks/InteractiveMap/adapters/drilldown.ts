import { sanitizeMapSvg } from "@/blocks/InteractiveMap/sanitize"
import { parseDrilldownAssetString } from "@/blocks/InteractiveMap/drilldown/parseAsset"
import { buildRegionIndex } from "@/blocks/InteractiveMap/drilldown/regions"
import type {
  ChildAssetRef,
  DrilldownAsset,
  RegionIndex,
} from "@/blocks/InteractiveMap/drilldown/types"

export interface RegionAssetInput {
  regionId: string
  /** The uploaded file's name in `map-assets`; null when the relationship is unpopulated. */
  filename: string | null
}

export interface ResolveDrilldownArgs {
  overviewSvg: string
  regionAssets: RegionAssetInput[]
}

export interface ResolvedDrilldown {
  overview: DrilldownAsset
  regions: RegionIndex
  childAssets: ChildAssetRef[]
  /** Configuration problems worth surfacing to an editor; the map still renders. */
  problems: string[]
}

/**
 * Same-origin, stable path for a map-assets upload. Local storage serves `public/map-assets`
 * here directly; with S3 enabled, `next.config.ts` rewrites the same path to the bucket, so
 * the URL a crawler finds in the HTML is the one the drill-in fetches.
 */
export function mapAssetPublicPath(filename: string): string {
  return `/map-assets/${encodeURIComponent(filename)}`
}

/**
 * Resolves a drilldown block's overview asset into the model the block renders: the parsed
 * geometry (server-rendered as the initial view), the region hierarchy for the selector and
 * pane, and the child asset URLs emitted into the HTML for the lazy drill-in fetch.
 * Child assets are NOT parsed here — the overview never pays for detail data.
 */
export function resolveDrilldownMap({
  overviewSvg,
  regionAssets,
}: ResolveDrilldownArgs): ResolvedDrilldown {
  const overview = parseDrilldownAssetString(sanitizeMapSvg(overviewSvg))
  const regions = buildRegionIndex([overview])
  const problems: string[] = []
  if (overview.payloadError) problems.push(`overview <metadata>: ${overview.payloadError}`)
  if (overview.viewBox === null) problems.push("overview has no usable viewBox")

  const childAssets: ChildAssetRef[] = []
  const seen = new Set<string>()
  for (const { regionId, filename } of regionAssets) {
    const id = regionId.trim()
    if (!id) continue
    if (!filename) {
      problems.push(`region asset for "${id}" is not populated (query depth too shallow?)`)
      continue
    }
    if (!regions.byId[id]) {
      problems.push(`region asset "${id}" matches no path id or declared region in the overview`)
      continue
    }
    if (seen.has(id)) {
      problems.push(`region "${id}" has more than one asset; using the first`)
      continue
    }
    seen.add(id)
    childAssets.push({ regionId: id, url: mapAssetPublicPath(filename) })
  }

  return { overview, regions, childAssets, problems }
}
