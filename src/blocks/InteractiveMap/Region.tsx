"use client"

import React, { useEffect, useMemo, useRef } from "react"
import type { PinnedTooltip } from "./Tooltip"
import type { ResolvedMap, ResolvedPath, ResolvedRegion } from "./types"

type RegionHandler = (mapIndex: number, region: ResolvedRegion) => void
type RegionClickHandler = (mapIndex: number, region: ResolvedRegion, x: number, y: number) => void

const OVERLAY_FADE_MS = 80

interface OverlayPathProps extends React.SVGProps<SVGPathElement> {
  "data-overlay": "active" | "pinned"
}

function PathOutline({ ref, ...props }: OverlayPathProps) {
  return (
    <path
      ref={ref}
      className="stroke-foreground pointer-events-none"
      fill="none"
      strokeWidth={2}
      vectorEffect="non-scaling-stroke"
      {...props}
    />
  )
}

type InteractivePath = ResolvedPath & { region: ResolvedRegion }

interface RegionPathProps {
  path: InteractivePath
  mapIndex: number
  onEnter: RegionHandler
  onLeave: () => void
  onClick: RegionClickHandler
}

function RegionPath({ path, mapIndex, onEnter, onLeave, onClick }: RegionPathProps) {
  const { region, d } = path

  const accessibleLabel = region.formattedValue
    ? `${region.label}: ${region.formattedValue}`
    : region.label

  return (
    <path
      d={d}
      fill={region.color}
      className="stroke-muted hover:stroke-accent-forground"
      strokeWidth={1}
      vectorEffect="non-scaling-stroke"
      aria-label={accessibleLabel}
      tabIndex={0}
      data-interactive-map-path=""
      style={{ cursor: "pointer", outline: "none" }}
      onPointerEnter={() => onEnter(mapIndex, region)}
      onPointerLeave={onLeave}
      onFocus={() => onEnter(mapIndex, region)}
      onBlur={onLeave}
      onClick={(e) => onClick(mapIndex, region, e.pageX, e.pageY)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          const rect = e.currentTarget.getBoundingClientRect()
          onClick(
            mapIndex,
            region,
            rect.left + rect.width / 2 + window.scrollX,
            rect.top + rect.height / 2 + window.scrollY,
          )
        }
      }}
    />
  )
}

interface HoverPathProps {
  d?: string | null
}

function HoverPath({ d }: HoverPathProps) {
  const pathRef = useRef<SVGPathElement | null>(null)
  const visibleRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const el = pathRef.current
    if (!el) return

    if (d) {
      if (!visibleRef.current) {
        el.setAttribute("d", d)
        requestAnimationFrame(() => {
          el.style.opacity = "1"
          visibleRef.current = true
        })
      } else {
        el.style.opacity = "0"
        visibleRef.current = false
        timerRef.current = setTimeout(() => {
          el.setAttribute("d", d)
          requestAnimationFrame(() => {
            el.style.opacity = "1"
            visibleRef.current = true
          })
        }, OVERLAY_FADE_MS)
      }
    } else {
      el.style.opacity = "0"
      visibleRef.current = false
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [d])

  return (
    <PathOutline
      ref={pathRef}
      data-overlay="active"
      d=""
      style={{ opacity: 0, transition: `opacity ${OVERLAY_FADE_MS}ms ease` }}
    />
  )
}

interface PathListProps {
  paths: InteractivePath[]
}

function PathList({ paths }: PathListProps): React.ReactNode {
  return (
    <>
      {paths.map(({ d, region }) => (
        <PathOutline key={region.regionId} data-overlay="pinned" d={d} />
      ))}
    </>
  )
}

interface RegionTitleProps {
  title: string | null
  invertColors: boolean
}

function RegionTitle({ title, invertColors }: RegionTitleProps): React.ReactNode {
  if (!title) return null
  const label = invertColors ? `${title} (Inverted)` : title
  return <figcaption className="mb-3 text-center text-sm font-medium">{label}</figcaption>
}

interface RegionProps {
  map: ResolvedMap
  mapIndex: number
  pinned: PinnedTooltip[]
  activeRegionKey: string | null
  onEnter: RegionHandler
  onLeave: () => void
  onClick: RegionClickHandler
}

function Region({
  map,
  mapIndex,
  pinned,
  activeRegionKey,
  onEnter,
  onLeave,
  onClick,
}: RegionProps): React.ReactElement {
  const pathByRegionId = useMemo(
    () => new Map(map.paths.filter((p) => p.region).map((p) => [p.region!.regionId, p])),
    [map.paths],
  )

  const activeRegion = activeRegionKey ? pathByRegionId.get(activeRegionKey) : null
  const pinnedRegions = pinned
    .filter((p) => p.mapIndex === mapIndex)
    .map((p) => pathByRegionId.get(p.region.regionId))
    .filter((p): p is InteractivePath => p != null)

  return (
    <figure className="min-w-0 flex-1 space-y-1">
      <RegionTitle title={map.title} invertColors={map.invertColors} />
      <svg
        viewBox={map.viewBox}
        preserveAspectRatio="xMidYMid meet"
        overflow="visible"
        style={{ display: "block", height: "auto", width: "100%" }}
      >
        <g transform={map.transform ?? undefined}>
          <g>
            {map.paths.map((path, i) =>
              path.region ? (
                <RegionPath
                  key={`${mapIndex}-${i}-${path.region.regionId}`}
                  path={path as InteractivePath}
                  mapIndex={mapIndex}
                  onEnter={onEnter}
                  onLeave={onLeave}
                  onClick={onClick}
                />
              ) : (
                <path key={`${mapIndex}-${i}`} d={path.d} {...path.extraAttrs} />
              ),
            )}
          </g>
          <g>
            <HoverPath d={activeRegion?.d} />
            <PathList paths={pinnedRegions} />
          </g>
        </g>
      </svg>
    </figure>
  )
}

export { Region }
