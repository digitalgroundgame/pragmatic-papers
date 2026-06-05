import React from "react"

import { resolveInlineSvgMap } from "@/blocks/InteractiveMap/adapters/inlineSvg"
import type { ResolvedMap } from "@/blocks/InteractiveMap/types"
import { CMSLink } from "@/components/Link/CMSLink2"
import { Logo } from "@/components/Logo"
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
  const resolvedMaps: ResolvedMap[] = maps
    .map((m): ResolvedMap | null => {
      const svg = readSvgContent(m.svgAsset)
      if (!svg) return null
      return resolveInlineSvgMap({
        title: m.title,
        svg,
        valueAttribute: m.valueAttribute,
        regions: m.regions ?? [],
        scaleType: colorScale,
      })
    })
    .filter((m): m is ResolvedMap => m !== null)

  if (resolvedMaps.length === 0) return null

  return (
    <figure className={cn("not-prose col-start-2 my-8 space-y-2", className)}>
      <InteractiveMapClient layout={layout} maps={resolvedMaps} />
      {widgetTitle && <figcaption className="text-lg font-semibold">{widgetTitle}</figcaption>}
      <div className="flex items-center gap-2">
        {sources && sources.length > 0 && (
          <p className="text-muted-foreground text-xs">
            Source{sources.length > 1 ? "s" : ""}:{" "}
            {sources.map(({ id, link }, i) => (
              <React.Fragment key={id || i}>
                <CMSLink link={link} className="underline" />
                {i < sources.length - 1 ? ", " : ""}
              </React.Fragment>
            ))}
          </p>
        )}
        <Logo className="ml-auto" size="xs" />
      </div>
    </figure>
  )
}
