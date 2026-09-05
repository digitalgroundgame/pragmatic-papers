import { parseDrilldownAssetString } from "@/blocks/InteractiveMap/drilldown/parseAsset"
import { sanitizeMapSvg } from "@/blocks/InteractiveMap/sanitize"

import type { GeometryFile } from "./types"

/**
 * Turns an exported SVG into the geometry the profile checks in. Runs at snapshot time, not
 * at render time: the page imports the resulting JSON and never parses SVG.
 *
 * Keeps only what shapes the hierarchy — `id`, `d`, `data-layer`, `data-parent-id` (or
 * upstream's `data-parent-circuit`), `data-inset`, `data-region-label`. Every other
 * attribute is dropped, so a file with facts baked into it yields the same geometry as a
 * clean one.
 */
export function svgToGeometryFile(svg: string): GeometryFile {
  const asset = parseDrilldownAssetString(sanitizeMapSvg(svg))
  return {
    viewBox: asset.viewBox,
    flipY: asset.flipY,
    paths: asset.paths.map(({ id, d, layer, parentId, inset, label, facts }) => ({
      id,
      d,
      layer,
      parentId: parentId ?? facts["parent-circuit"] ?? null,
      inset,
      label,
    })),
  }
}
