import { sanitizeMapSvg } from "@/blocks/InteractiveMap/sanitize"
import { parsePathAbs, serializePath } from "@/interactives/engine/morph"
import { parseDrilldownAssetString } from "@/interactives/engine/parseAsset"

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
/**
 * Nudge whole regions across a geometry file, by region id, in that file's own units.
 *
 * The shapes come from a QGIS export, and where the insets sit in it — Alaska under the
 * southwest, Hawaii and the territories in a row beside them — is a placement decision rather
 * than a fact about the world. This is where that decision is kept: a layer of offsets over
 * the export, so moving Alaska does not mean re-exporting and does not go missing the next
 * time somebody does. Nothing here moves unless an offset names it.
 *
 * Every map gets its own set, because Alaska is placed twice: once beside the southwest on the
 * national map, and again on the Ninth's own, where it is a district among the Ninth's and
 * sits somewhere else entirely. The units differ too — each file is separately projected.
 *
 * Paths are absolute `M`/`L` by contract, so a translation is arithmetic on the points.
 */
export function offsetGeometry(
  file: GeometryFile,
  offsets: Record<string, readonly number[]> | undefined,
): GeometryFile {
  if (!offsets || Object.keys(offsets).length === 0) return file
  let moved = false
  const paths = file.paths.map((p) => {
    const by = p.id ? offsets[p.id] : undefined
    if (!by || by.length !== 2 || !by.every((n) => Number.isFinite(n))) return p
    const subs = parsePathAbs(p.d)
    if (!subs) return p
    const [dx, dy] = by as [number, number]
    for (const sub of subs) {
      for (let i = 0; i < sub.length; i += 2) {
        sub[i] = sub[i]! + dx
        sub[i + 1] = sub[i + 1]! + dy
      }
    }
    moved = true
    return { ...p, d: serializePath(subs) }
  })
  return moved ? { ...file, paths } : file
}

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
