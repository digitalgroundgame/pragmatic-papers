import { type ColorScaleType, formatValue, resolveColor } from "@/blocks/InteractiveMap/colorScale"
import { sanitizeMapSvg } from "@/blocks/InteractiveMap/sanitize"
import type { RegionDatum, ResolvedMap } from "@/blocks/InteractiveMap/types"

interface ResolveInlineSvgArgs {
  title?: string | null
  svg: string
  regionAttribute?: string | null
  regions: RegionDatum[]
  scaleType: ColorScaleType
  neutralFill?: string
}

export function resolveInlineSvgMap({
  title,
  svg,
  regionAttribute,
  regions,
  scaleType,
  neutralFill,
}: ResolveInlineSvgArgs): ResolvedMap {
  const attribute = (regionAttribute?.trim() || "data-region").replace(/^data-/, "data-")
  const sanitized = sanitizeMapSvg(svg ?? "")

  const resolved = regions.map((r) => ({
    regionId: r.regionId,
    label: r.label?.trim() || r.regionId,
    formattedValue: formatValue(scaleType, r.value),
    color: resolveColor({
      scaleType,
      value: r.value,
      overrideColor: r.color,
      neutralFill,
    }),
  }))

  return {
    title: title ?? null,
    svg: sanitized,
    regionAttribute: attribute,
    regions: resolved,
  }
}
