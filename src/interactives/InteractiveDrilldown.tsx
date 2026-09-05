import React from "react"

import "@/blocks/InteractiveMap/styles.css"

import { DrilldownMapClient } from "@/blocks/InteractiveMap/drilldown/DrilldownMapClient"
import { DrilldownOverviewSvg } from "@/blocks/InteractiveMap/drilldown/DrilldownOverviewSvg"
import { buildRegionIndex } from "@/blocks/InteractiveMap/drilldown/regions"
import type { DrilldownAsset } from "@/blocks/InteractiveMap/drilldown/types"

import type { ComposedOverview } from "./load"

/** The overview asset without its path data: the client reads geometry from the rendered SVG. */
function stripGeometry(asset: DrilldownAsset): DrilldownAsset {
  return { ...asset, paths: asset.paths.map((p) => ({ ...p, d: "" })) }
}

interface InteractiveDrilldownProps {
  composed: ComposedOverview
  /** Empty-state text for the pane, in the interactive's own vocabulary. */
  emptyHint?: string
}

/**
 * The drilldown as a page section: region strip, map, pane beneath. The overview is complete
 * in the initial HTML; regions load lazily from the same-origin JSON routes prefetched here,
 * so a crawler that follows same-origin references captures a working archive.
 */
export function InteractiveDrilldown({
  composed,
  emptyHint,
}: InteractiveDrilldownProps): React.ReactElement {
  const { overview, childAssets } = composed
  const regions = buildRegionIndex([overview])
  return (
    <section data-interactive-drilldown="" aria-label="Interactive map">
      {childAssets.map((a) => (
        <link key={a.regionId} rel="prefetch" as="fetch" href={a.url} />
      ))}
      <DrilldownMapClient
        layout="stacked"
        emptyHint={emptyHint}
        overview={stripGeometry(overview)}
        childAssets={childAssets}
      >
        <div data-drilldown-layer="overview" data-state="visible">
          <DrilldownOverviewSvg asset={overview} regions={regions} />
        </div>
      </DrilldownMapClient>
    </section>
  )
}
