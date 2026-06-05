import React from "react"

import { resolveInlineSvgMap } from "@/blocks/InteractiveMap/adapters/inlineSvg"
import type { ColorScaleType } from "@/blocks/InteractiveMap/colorScale"
import type { ResolvedMap } from "@/blocks/InteractiveMap/types"
import type { InteractiveMapBlock as InteractiveMapBlockProps } from "@/payload-types"
import { cn } from "@/utilities/utils"

import { InteractiveMapClient } from "./Component.client"

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
  maps,
  sources,
}) => {
  const scaleType: ColorScaleType = colorScale ?? "divergingRedBlue"

  const resolvedMaps: ResolvedMap[] = (maps ?? [])
    .map((m): ResolvedMap | null => {
      const svg = readSvgContent(m.svgAsset)
      if (!svg) return null
      const regions = (m.regions ?? []).map((r) => ({
        regionId: r.regionId,
        label: r.label,
        value: r.value,
        color: r.color,
      }))
      return resolveInlineSvgMap({
        title: m.title,
        svg,
        regionAttribute: m.regionAttribute,
        regions,
        scaleType,
      })
    })
    .filter((m): m is ResolvedMap => m !== null)

  if (resolvedMaps.length === 0) return null

  return (
    <figure className={cn("not-prose col-start-2 my-8 space-y-2", className)}>
      <InteractiveMapClient layout={layout} maps={resolvedMaps} />
      {widgetTitle && <figcaption className="text-lg font-semibold">{widgetTitle}</figcaption>}
      {sources && sources.length > 0 && (
        <p className="text-muted-foreground text-xs">
          Source{sources.length > 1 ? "s" : ""}:{" "}
          {sources.map((s, i) => (
            <React.Fragment key={i}>
              {s.url ? (
                <a href={s.url} rel="noopener noreferrer" target="_blank" className="underline">
                  {s.name}
                </a>
              ) : (
                <>{s.name}</>
              )}
              {i < sources.length - 1 ? ", " : ""}
            </React.Fragment>
          ))}
        </p>
      )}
    </figure>
  )
}
