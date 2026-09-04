import React from "react"

import type { ResolvedDrilldown } from "@/blocks/InteractiveMap/adapters/drilldown"
import { Sources } from "@/blocks/InteractiveMap/Sources"
import type { InteractiveMapBlock as InteractiveMapBlockProps } from "@/payload-types"
import { cn } from "@/utilities/utils"

import { DrilldownOverviewSvg } from "./DrilldownOverviewSvg"
import { displayFacts } from "./regions"

interface DrilldownMapProps {
  widgetTitle?: string | null
  sources: InteractiveMapBlockProps["sources"]
  resolved: ResolvedDrilldown
  className?: string
}

/**
 * Server shell for the drilldown mode. The overview — geometry, region list and facts — is
 * complete in the initial HTML; the drill-in interaction is a client enhancement that loads
 * child assets from the same-origin URLs prefetched here. This is the first block whose full
 * content is not in the initial response; the prefetch links exist so a crawler that follows
 * same-origin references captures everything a working archive needs.
 */
export function DrilldownMap({
  widgetTitle,
  sources,
  resolved,
  className,
}: DrilldownMapProps): React.ReactElement {
  const { overview, regions, childAssets } = resolved
  const drillable = new Set(childAssets.map((a) => a.regionId))

  return (
    <figure
      data-interactive-map-block
      data-map-mode="drilldown"
      className={cn("not-prose my-8 flex flex-col gap-2", className)}
    >
      {widgetTitle && (
        <figcaption className="text-center text-lg font-semibold">{widgetTitle}</figcaption>
      )}
      {childAssets.map((a) => (
        <link key={a.regionId} rel="prefetch" as="fetch" href={a.url} />
      ))}
      <div data-drilldown-map="" className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <nav
          aria-label="Regions"
          className="text-muted-foreground flex shrink-0 flex-row flex-wrap gap-1 text-xs sm:w-40 sm:flex-col"
        >
          {regions.topLevel.map((id) => {
            const region = regions.byId[id]!
            return (
              <div
                key={id}
                className="bg-muted/40 rounded-xs px-2 py-1"
                data-region-item={id}
                data-drillable={drillable.has(id) ? "true" : undefined}
              >
                <span className="text-foreground font-medium">{region.label}</span>
                {region.summary && <span className="block opacity-80">{region.summary}</span>}
                {displayFacts(region, overview.payload).length > 0 && (
                  <dl className="mt-0.5 grid grid-cols-[auto_1fr] gap-x-2">
                    {displayFacts(region, overview.payload).map((f) => (
                      <React.Fragment key={f.key}>
                        <dt className="opacity-70">{f.label}</dt>
                        <dd className="font-medium">{f.value}</dd>
                      </React.Fragment>
                    ))}
                  </dl>
                )}
              </div>
            )
          })}
        </nav>
        <div className="min-w-0 flex-1" data-drilldown-viewport="">
          <DrilldownOverviewSvg asset={overview} regions={regions} />
        </div>
      </div>
      <Sources sources={sources} colorBias={null} />
    </figure>
  )
}
