import dynamic from "next/dynamic"
import React from "react"

import type { ResolvedDrilldown } from "@/blocks/InteractiveMap/adapters/drilldown"
import { Sources } from "@/blocks/InteractiveMap/Sources"
import type { InteractiveMapBlock as InteractiveMapBlockProps } from "@/payload-types"
import { cn } from "@/utilities/utils"

import { DrilldownOverviewSvg } from "./DrilldownOverviewSvg"
import type { DrilldownAsset } from "./types"

// The drilldown client (morph engine, seat chart, record pane) is a lot of JavaScript that a
// choropleth article must not pay for, so it is split into its own chunk — the same
// precedent as MathJaxProvider. It still server-renders, so the overview is complete HTML.
const DrilldownMapClient = dynamic(() =>
  import("./DrilldownMapClient").then((m) => m.DrilldownMapClient),
)

interface DrilldownMapProps {
  widgetTitle?: string | null
  sources: InteractiveMapBlockProps["sources"]
  resolved: ResolvedDrilldown
  className?: string
}

/** The overview asset without its path data: the client reads geometry from the rendered SVG. */
function stripGeometry(asset: DrilldownAsset): DrilldownAsset {
  return { ...asset, paths: asset.paths.map((p) => ({ ...p, d: "" })) }
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

  return (
    <figure
      data-interactive-map-block
      data-map-mode="drilldown"
      // Breaks out of the prose column to the site container's width (see styles.css, keyed on
      // the article page's `@container/page` wrapper): the map, its selector and the pane need
      // the room, and the article never reflows because the viewport height follows its aspect
      // ratio.
      className={cn("not-prose my-8 flex flex-col gap-2", className)}
    >
      {widgetTitle && (
        <figcaption className="text-center text-lg font-semibold">{widgetTitle}</figcaption>
      )}
      {childAssets.map((a) => (
        <link key={a.regionId} rel="prefetch" as="fetch" href={a.url} />
      ))}
      <DrilldownMapClient overview={stripGeometry(overview)} childAssets={childAssets}>
        <div data-drilldown-layer="overview" data-state="visible">
          <DrilldownOverviewSvg asset={overview} regions={regions} />
        </div>
      </DrilldownMapClient>
      <Sources sources={sources} colorBias={null} />
    </figure>
  )
}
