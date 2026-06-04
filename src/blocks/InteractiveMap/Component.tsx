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
    <figure className={cn("not-prose col-start-2 my-8", className)}>
      {widgetTitle ? (
        <figcaption className="mb-3 text-center font-serif text-lg font-semibold">
          {widgetTitle}
        </figcaption>
      ) : null}
      <InteractiveMapClient layout={layout ?? "row"} maps={resolvedMaps} />
      {sources && sources.length > 0 ? (
        <p className="text-muted-foreground mt-2 text-center text-xs">
          Source{sources.length > 1 ? "s" : ""}:{" "}
          {sources.map((s, i) => {
            const sep = i < sources.length - 1 ? ", " : ""
            if (s.url) {
              return (
                <React.Fragment key={i}>
                  <a href={s.url} rel="noopener noreferrer" target="_blank" className="underline">
                    {s.name}
                  </a>
                  {sep}
                </React.Fragment>
              )
            }
            return (
              <React.Fragment key={i}>
                {s.name}
                {sep}
              </React.Fragment>
            )
          })}
        </p>
      ) : null}
    </figure>
  )
}
