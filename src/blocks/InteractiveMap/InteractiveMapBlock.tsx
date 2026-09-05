import React from "react"

import "@/blocks/InteractiveMap/styles.css"

import { resolveDrilldownMap } from "@/blocks/InteractiveMap/adapters/drilldown"
import { resolveInlineSvgMap } from "@/blocks/InteractiveMap/adapters/inlineSvg"
import { DrilldownMap } from "@/blocks/InteractiveMap/drilldown/DrilldownMap"
import type { ResolvedMap } from "@/blocks/InteractiveMap/types"
import type { InteractiveMapBlock as InteractiveMapBlockProps, MapAsset } from "@/payload-types"
import { cn } from "@/utilities/utils"
import { isResolved } from "@/utilities/relationships"

import { getDivergingRedBlueLegend } from "./colorScale"
import { InteractiveMapClient } from "./InteractiveMapClient"
import { Legend } from "./Legend"
import { Sources } from "./Sources"

// Blocks saved before `mode` existed carry no value for it, so it is optional at the boundary
// even though the generated type marks it required.
type Props = Omit<InteractiveMapBlockProps, "mode"> & {
  mode?: InteractiveMapBlockProps["mode"] | null
  className?: string
}

function readSvgContent(asset: number | MapAsset | null | undefined): string {
  if (!isResolved(asset)) return ""
  return asset.svgContent ?? ""
}

export const InteractiveMapBlock: React.FC<Props> = ({
  className,
  widgetTitle,
  mode,
  layout,
  colorScale,
  colorBias,
  maps,
  drilldown,
  sources,
}) => {
  if (mode === "drilldown") {
    const overviewSvg = readSvgContent(drilldown?.overviewAsset)
    if (!overviewSvg) return null
    const resolved = resolveDrilldownMap({
      overviewSvg,
      regionAssets: (drilldown?.regionAssets ?? []).map((r) => ({
        regionId: r.regionId,
        filename: isResolved(r.svgAsset) ? (r.svgAsset.filename ?? null) : null,
      })),
    })
    return (
      <DrilldownMap
        widgetTitle={widgetTitle}
        sources={sources}
        resolved={resolved}
        className={className}
      />
    )
  }

  const scaleType = colorScale ?? "divergingRedBlue"
  const resolvedMaps: ResolvedMap[] = (maps ?? [])
    .map((m): ResolvedMap | null => {
      const svg = readSvgContent(m.svgAsset)
      if (!svg) return null
      return resolveInlineSvgMap({
        title: m.title,
        svg,
        dataAttribute: m.dataAttribute,
        overrides: m.overrides,
        scaleType,
        colorBias,
        invertColors: m.invertColors,
      })
    })
    .filter((m): m is ResolvedMap => m !== null)

  if (resolvedMaps.length === 0) return null

  const legend = scaleType === "divergingRedBlue" ? getDivergingRedBlueLegend(colorBias) : null

  return (
    <figure
      data-interactive-map-block
      className={cn("not-prose my-8 flex flex-col gap-2", className)}
    >
      {widgetTitle && (
        <figcaption className="text-center text-lg font-semibold">{widgetTitle}</figcaption>
      )}
      <InteractiveMapClient layout={layout} maps={resolvedMaps} />
      <Legend legend={legend} layout={layout} />
      <Sources sources={sources} colorBias={colorBias} />
    </figure>
  )
}
