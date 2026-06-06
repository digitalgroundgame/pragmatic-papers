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
  overrides?: RegionDatum[] | null
  scaleType: ColorScaleType
  colorBias?: number | null
  invertColors?: boolean | null
  neutralFill?: string
}

export function resolveInlineSvgMap({
  title,
  svg,
  dataAttribute,
  overrides,
  scaleType,
  colorBias,
  invertColors,
  neutralFill,
}: ResolveInlineSvgArgs): ResolvedMap {
  const sanitized = sanitizeMapSvg(svg ?? "")
  const parsed = parseInlineSvg(sanitized, "id", dataAttribute)

  const regionOverrides = new Map((overrides ?? []).map((r) => [r.regionId, r]))
  const format = inferValueFormat(dataAttribute)

  // Build one ResolvedRegion per unique regionId (multiple paths may share one).
  const regionById = new Map<string, ResolvedRegion>()
  for (const p of parsed.paths) {
    if (p.regionId == null || regionById.has(p.regionId)) continue
    const override = regionOverrides.get(p.regionId)
    const value = override?.value ?? p.value
    const svgLabel = p.extraAttrs["data-label"]?.trim() || null
    regionById.set(p.regionId, {
      regionId: p.regionId,
      label: override?.label?.trim() || svgLabel || p.regionId,
      formattedValue: formatValue(format, value),
      color: resolveColor({
        scaleType,
        value,
        overrideColor: override?.color,
        bias: colorBias ?? 1,
        invert: invertColors ?? undefined,
        neutralFill,
      }),
    })
  }

  return {
    title: title ?? null,
    viewBox: parsed.viewBox ?? DEFAULT_VIEWBOX,
    transform: parsed.transform,
    paths: parsed.paths.map((p) => ({
      ...p,
      region: p.regionId != null ? (regionById.get(p.regionId) ?? null) : null,
    })),
  }
}
