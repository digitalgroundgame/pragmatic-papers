import React from "react"

import "@/interactives/engine/styles.css"

import { DrilldownMapClient } from "@/interactives/engine/DrilldownMapClient"
import { DrilldownOverviewSvg } from "@/interactives/engine/DrilldownOverviewSvg"
import { buildRegionIndex } from "@/interactives/engine/regions"
import type { DrilldownAsset } from "@/interactives/engine/types"

import type { ComposedOverview } from "./load"

/** The overview asset without its path data: the client reads geometry from the rendered SVG. */
function stripGeometry(asset: DrilldownAsset): DrilldownAsset {
  return { ...asset, paths: asset.paths.map((p) => ({ ...p, d: "" })) }
}

interface InteractiveDrilldownProps {
  composed: ComposedOverview
  /** Empty-state text for the pane, in the interactive's own vocabulary. */
  emptyHint?: string
  /** Placeholder for the record search box ("Search judges"). */
  searchLabel?: string
  /** The profile's landing view, shown in the pane until a region is chosen. */
  summary?: React.ReactNode
}

/**
 * The drilldown as a page section: region strip, map, pane beneath. The overview is complete
 * in the initial HTML; regions load lazily from the same-origin JSON routes prefetched here —
 * both halves of each, shapes and records — so a crawler that follows same-origin references
 * captures a working archive.
 */
export function InteractiveDrilldown({
  composed,
  emptyHint,
  searchLabel,
  summary,
}: InteractiveDrilldownProps): React.ReactElement {
  const { overview, childAssets } = composed
  const regions = buildRegionIndex([overview])
  return (
    <section data-interactive-drilldown="" aria-label="Interactive map">
      {childAssets.map(({ regionId, url, geometryUrl }) => (
        <React.Fragment key={regionId}>
          <link rel="prefetch" as="fetch" href={url} />
          <link rel="prefetch" as="fetch" href={geometryUrl} />
        </React.Fragment>
      ))}
      <DrilldownMapClient
        emptyHint={emptyHint}
        summary={summary}
        search={{ url: composed.searchUrl, ...(searchLabel ? { label: searchLabel } : {}) }}
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
