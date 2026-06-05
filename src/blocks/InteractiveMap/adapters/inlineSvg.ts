import {
  type ColorScaleType,
  formatValue,
  inferValueFormat,
  resolveColor,
} from "@/blocks/InteractiveMap/colorScale"
import { parseInlineSvg } from "@/blocks/InteractiveMap/parseInlineSvg"
import { sanitizeMapSvg } from "@/blocks/InteractiveMap/sanitize"
import type { RegionDatum, ResolvedMap, ResolvedRegion } from "@/blocks/InteractiveMap/types"

const DEFAULT_VIEWBOX = "0 0 100 100"

interface ResolveInlineSvgArgs {
  title?: string | null
  svg: string
  dataAttribute?: string | null
  overrides: RegionDatum[]
  scaleType: ColorScaleType
  neutralFill?: string
}

export function resolveInlineSvgMap({
  title,
  svg,
  dataAttribute,
  overrides,
  scaleType,
  neutralFill,
}: ResolveInlineSvgArgs): ResolvedMap {
  const sanitized = sanitizeMapSvg(svg ?? "")
  const parsed = parseInlineSvg(sanitized, "id", dataAttribute ?? undefined)

  const regionOverrides = new Map(overrides.map((r) => [r.regionId, r]))
  const seenIds = new Set<string>()
  const resolvedRegions: ResolvedRegion[] = []

  const format = inferValueFormat(dataAttribute)

  for (const p of parsed.paths) {
    if (p.regionId == null || seenIds.has(p.regionId)) continue
    seenIds.add(p.regionId)
    const override = regionOverrides.get(p.regionId)
    const value = override?.value ?? p.value
    const svgLabel = p.extraAttrs["data-label"]?.trim() || null
    resolvedRegions.push({
      regionId: p.regionId,
      label: override?.label?.trim() || svgLabel || p.regionId,
      formattedValue: formatValue(format, value),
      color: resolveColor({ scaleType, value, overrideColor: override?.color, neutralFill }),
    })
  }

  return {
    title: title ?? null,
    viewBox: parsed.viewBox ?? DEFAULT_VIEWBOX,
    transform: parsed.transform,
    paths: parsed.paths,
    regions: resolvedRegions,
  }
}
