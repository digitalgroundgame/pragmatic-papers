import React from "react"

import "@/blocks/InteractiveMap/styles.css"

import { resolveInlineSvgMap } from "@/blocks/InteractiveMap/adapters/inlineSvg"
import type { ResolvedMap } from "@/blocks/InteractiveMap/types"
import type { InteractiveMapBlock as InteractiveMapBlockProps } from "@/payload-types"
import { cn } from "@/utilities/utils"

import { getDivergingRedBlueLegend } from "./colorScale"
import { InteractiveMapClient } from "./InteractiveMapClient"
import { Legend } from "./Legend"
import { Sources } from "./Sources"

type Props = InteractiveMapBlockProps & {
  className?: string
}

function readSvgContent(asset: InteractiveMapBlockProps["maps"][number]["svgAsset"]): string {
  if (!asset || typeof asset === "number") return ""
  return asset.svgContent ?? ""
}

export const InteractiveMapBlock: React.FC<Props> = ({
  className,
  widgetTitle,
  layout,
  colorScale,
  colorBias,
  maps,
  sources,
}) => {
  const resolvedMaps: ResolvedMap[] = maps
    .map((m): ResolvedMap | null => {
      const svg = readSvgContent(m.svgAsset)
      if (!svg) return null
      return resolveInlineSvgMap({
        title: m.title,
        svg,
        dataAttribute: m.dataAttribute,
        overrides: m.overrides,
        scaleType: colorScale,
        colorBias,
        invertColors: m.invertColors,
      })
    })
    .filter((m): m is ResolvedMap => m !== null)

  if (resolvedMaps.length === 0) return null

  const legend = colorScale === "divergingRedBlue" ? getDivergingRedBlueLegend(colorBias) : null

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
