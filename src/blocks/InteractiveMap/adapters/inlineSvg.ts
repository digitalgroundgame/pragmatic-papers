import { type ColorScaleType, formatValue, resolveColor } from "@/blocks/InteractiveMap/colorScale"
import { parseInlineSvg } from "@/blocks/InteractiveMap/parseInlineSvg"
import { sanitizeMapSvg } from "@/blocks/InteractiveMap/sanitize"
import type { RegionDatum, ResolvedMap } from "@/blocks/InteractiveMap/types"

const DEFAULT_VIEWBOX = "0 0 100 100"

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
  const attribute = regionAttribute?.trim() || "data-region"
  const sanitized = sanitizeMapSvg(svg ?? "")
  const parsed = parseInlineSvg(sanitized, attribute)

  return {
    title: title ?? null,
    viewBox: parsed.viewBox ?? DEFAULT_VIEWBOX,
    transform: parsed.transform,
    paths: parsed.paths,
    regions: regions.map((r) => ({
      regionId: r.regionId,
      label: r.label?.trim() || r.regionId,
      formattedValue: formatValue(scaleType, r.value),
      color: resolveColor({
        scaleType,
        value: r.value,
        overrideColor: r.color,
        neutralFill,
      }),
    })),
  }
}
