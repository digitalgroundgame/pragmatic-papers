import React from "react"

import { DEFAULT_VIEWBOX, flipTransform, padViewBox, viewBoxAttr } from "./geometry"
import type { DrilldownAsset, DrilldownPath, RegionIndex } from "./types"

export type OverviewPathRole = "parent" | "child" | "outline" | "decorative"

interface DrilldownOverviewSvgProps {
  asset: DrilldownAsset
  regions: RegionIndex
}

/**
 * Server-rendered overview geometry. Paint order, bottom to top: parent fills, child
 * borders (insets keep a fill because they are their parent's only presence in that spot),
 * decorative geometry, then a stroke-only clone of each parent outline so parent boundaries
 * read clearly over the thin child borders. The client stage adopts this DOM on mount and
 * adds its own hover overlay and annotations into the trailing group.
 */
export function DrilldownOverviewSvg({
  asset,
  regions,
}: DrilldownOverviewSvgProps): React.ReactElement {
  const raw = asset.viewBox ?? DEFAULT_VIEWBOX
  const vb = padViewBox(raw)
  const transform = asset.flipY ? flipTransform(raw) : undefined

  const parents: DrilldownPath[] = []
  const children: DrilldownPath[] = []
  const decorative: DrilldownPath[] = []
  for (const p of asset.paths) {
    if (!p.id) decorative.push(p)
    else if (p.parentId) children.push(p)
    else parents.push(p)
  }

  const labelFor = (p: DrilldownPath): string => regions.byId[p.id ?? ""]?.label ?? p.id ?? ""

  return (
    <svg
      data-drilldown-overview=""
      viewBox={viewBoxAttr(vb)}
      preserveAspectRatio="xMidYMid meet"
      overflow="visible"
      role="group"
      aria-label="Overview map"
      style={{ display: "block", width: "100%", height: "100%" }}
    >
      <g transform={transform} data-drilldown-shapes="">
        {parents.map((p, i) => (
          <path
            key={`p-${i}`}
            d={p.d}
            data-region-id={p.id!}
            data-role="parent"
            data-layer={p.layer ?? undefined}
            data-inset={p.inset ? "true" : undefined}
            tabIndex={0}
            aria-label={labelFor(p)}
          />
        ))}
        {children.map((p, i) => (
          <path
            key={`c-${i}`}
            d={p.d}
            data-region-id={p.id!}
            data-role="child"
            data-parent-id={p.parentId!}
            data-layer={p.layer ?? undefined}
            data-inset={p.inset ? "true" : undefined}
            // An inset stands in for its parent on the overview (click Alaska → the 9th).
            tabIndex={p.inset ? 0 : undefined}
            aria-label={p.inset ? labelFor(p) : undefined}
          />
        ))}
        {decorative.map((p, i) => (
          <path key={`d-${i}`} d={p.d} data-role="decorative" />
        ))}
        {parents.map((p, i) => (
          <path key={`o-${i}`} d={p.d} data-role="outline" data-outline-for={p.id!} />
        ))}
      </g>
      <g data-drilldown-annotations="" />
    </svg>
  )
}
