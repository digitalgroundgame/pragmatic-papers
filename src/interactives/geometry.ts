import { sanitizeMapSvg } from "@/blocks/InteractiveMap/sanitize"
import { padViewBox, ZOOM_MAX } from "@/interactives/engine/geometry"
import { parsePathAbs, serializePath } from "@/interactives/engine/morph"
import { parseDrilldownAssetString } from "@/interactives/engine/parseAsset"
import type { ViewBox } from "@/interactives/engine/types"

import type { GeometryFile } from "./types"

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

/**
 * Device pixels across the widest map the stage can draw: full screen on a 6K-class display
 * (3072 CSS px) at 2x. No reader gets a wider one, so a step that holds here holds everywhere.
 */
export const MAX_MAP_DEVICE_PX = 6144

/** The largest of 1, 2, 5, 10, 20, 50, … that is no more than `x`, and never under 1. */
function niceFloor(x: number): number {
  if (!(x >= 1)) return 1
  const p = 10 ** Math.floor(Math.log10(x))
  const m = x / p
  return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p
}

/**
 * How coarse a map's coordinates can be without anyone seeing it: how many of the export's
 * units make one unit of the file the snapshot writes.
 *
 * Exports are in projected metres, seven digits a coordinate, and the overview is in every
 * page view twice over (the HTML and the RSC payload), so those digits were most of the
 * document. Rounding to a step moves a vertex by at most step/√2. The step is the largest of
 * 1, 2, 5, 10, … that keeps that under one device pixel at the stage's deepest zoom
 * (`ZOOM_MAX`) on the widest map it can draw (`MAX_MAP_DEVICE_PX`).
 */
export function geometryStep(viewBox: ViewBox | null): number {
  if (!viewBox) return 1
  const [, , w, h] = padViewBox(viewBox)
  // The map is letterboxed with one scale for both axes, so the long side sets it.
  const unitsPerDevicePx = Math.max(w, h) / (MAX_MAP_DEVICE_PX * ZOOM_MAX)
  return niceFloor(Math.SQRT2 * unitsPerDevicePx)
}

const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g

/**
 * A path with every coordinate divided by `by` and rounded. Only absolute `M`, `L`, `H`, `V`
 * and `Z`, whose every number is a coordinate; anything else is refused rather than half
 * scaled.
 */
export function scalePath(d: string, by: number): string {
  if (/[^MLHVZ\d\s,.eE+-]/.test(d)) throw new Error(`not an absolute M/L path: ${d.slice(0, 60)}`)
  return d
    .replace(NUMBER, (n) => ` ${Math.round(Number(n) / by) || 0} `)
    .replace(/[\s,]*([MLHVZ])[\s,]*/g, "$1")
    .replace(/[\s,]+/g, " ")
    .trim()
}

/**
 * The same file on a coarser grid: every coordinate divided by `step / file.step` and rounded,
 * the viewBox's edges rounded the same way so it still frames the shapes exactly.
 *
 * Rounding is per coordinate, so a vertex two regions share lands on the same point in both
 * and a shared border cannot open; and no vertex is dropped or merged, so an overview shape
 * and its twin in a child map keep the same count and still pair for the morph. Everything
 * else measured in the file's units — `offsets.json`, `anchors.json` — has to be divided by
 * the same factor.
 */
export function quantizeGeometry(file: GeometryFile, step: number): GeometryFile {
  const by = step / (file.step ?? 1)
  if (by === 1) return { ...file, step }
  const q = (v: number): number => Math.round(v / by) || 0
  let viewBox: ViewBox | null = null
  if (file.viewBox) {
    const [x, y, w, h] = file.viewBox
    viewBox = [q(x), q(y), q(x + w) - q(x), q(y + h) - q(y)]
  }
  return {
    viewBox,
    flipY: file.flipY,
    step,
    paths: file.paths.map((p) => ({ ...p, d: scalePath(p.d, by) })),
  }
}

/**
 * Turns an exported SVG into the geometry the profile checks in. Runs at snapshot time, not
 * at render time: the page imports the resulting JSON and never parses SVG.
 *
 * Keeps only what shapes the hierarchy — `id`, `d`, `data-layer`, `data-parent-id` (or
 * upstream's `data-parent-circuit`), `data-inset`, `data-region-label`. Every other
 * attribute is dropped, so a file with facts baked into it yields the same geometry as a
 * clean one.
 *
 * Coordinates are rounded to `step` (see `geometryStep`), the one the checked-in file already
 * uses when there is one, so the offsets and anchors measured in its units still apply.
 */
export function svgToGeometryFile(svg: string, step?: number): GeometryFile {
  const asset = parseDrilldownAssetString(sanitizeMapSvg(svg))
  const file: GeometryFile = {
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
  return quantizeGeometry(file, step ?? geometryStep(file.viewBox))
}
