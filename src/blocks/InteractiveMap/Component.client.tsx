"use client"

import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"

import type { ResolvedMap, ResolvedPath, ResolvedRegion } from "@/blocks/InteractiveMap/types"
import type { InteractiveMapBlock } from "@/payload-types"
import { cn } from "@/utilities/utils"

interface InteractiveMapClientProps {
  layout: InteractiveMapBlock["layout"]
  maps: ResolvedMap[]
}

interface PinnedTooltip {
  id: string
  mapIndex: number
  region: ResolvedRegion
  cursor: { x: number; y: number }
}

type RegionHandler = (mapIndex: number, region: ResolvedRegion) => void
type RegionClickHandler = (mapIndex: number, region: ResolvedRegion, x: number, y: number) => void

const TOOLTIP_OFFSET = 8
const OVERLAY_FADE_MS = 80

interface MapPathProps {
  path: ResolvedPath
  region: ResolvedRegion | null
  mapIndex: number
  onEnter: RegionHandler
  onLeave: () => void
  onClick: RegionClickHandler
}

function MapPath({ path, region, mapIndex, onEnter, onLeave, onClick }: MapPathProps) {
  const fill = region?.color
  const accessibleLabel = region
    ? region.formattedValue
      ? `${region.label}: ${region.formattedValue}`
      : region.label
    : (path.regionId ?? "")
  const interactive = region !== null

  return (
    <path
      d={path.d}
      fill={fill}
      className="stroke-white dark:stroke-black"
      strokeWidth={1.5}
      vectorEffect="non-scaling-stroke"
      aria-label={accessibleLabel || undefined}
      tabIndex={interactive ? 0 : undefined}
      data-interactive-map-path={interactive ? "" : undefined}
      style={interactive ? { cursor: "pointer", outline: "none" } : undefined}
      onPointerEnter={interactive ? () => onEnter(mapIndex, region) : undefined}
      onPointerLeave={interactive ? onLeave : undefined}
      onFocus={interactive ? () => onEnter(mapIndex, region) : undefined}
      onBlur={interactive ? onLeave : undefined}
      onClick={interactive ? (e) => onClick(mapIndex, region, e.clientX, e.clientY) : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                const rect = e.currentTarget.getBoundingClientRect()
                onClick(mapIndex, region, rect.left + rect.width / 2, rect.top + rect.height / 2)
              }
            }
          : undefined
      }
    />
  )
}

interface SingleMapProps {
  map: ResolvedMap
  mapIndex: number
  pinnedRegionIds: string[]
  hoverRegionId: string | null
  onEnter: RegionHandler
  onLeave: () => void
  onClick: RegionClickHandler
}

function ActiveOverlay({ activePath }: { activePath: ResolvedPath | null }) {
  const pathRef = useRef<SVGPathElement | null>(null)
  const visibleRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const el = pathRef.current
    if (!el) return

    if (activePath) {
      if (!visibleRef.current) {
        el.setAttribute("d", activePath.d)
        requestAnimationFrame(() => {
          el.style.opacity = "1"
          visibleRef.current = true
        })
      } else {
        el.style.opacity = "0"
        visibleRef.current = false
        timerRef.current = setTimeout(() => {
          el.setAttribute("d", activePath.d)
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
  }, [activePath])

  return (
    <path
      ref={pathRef}
      data-active-overlay=""
      className="pointer-events-none stroke-black dark:stroke-white"
      d=""
      fill="none"
      strokeWidth={2}
      vectorEffect="non-scaling-stroke"
      style={{ opacity: 0, transition: `opacity ${OVERLAY_FADE_MS}ms ease` }}
    />
  )
}

function SingleMap({
  map,
  mapIndex,
  pinnedRegionIds,
  hoverRegionId,
  onEnter,
  onLeave,
  onClick,
}: SingleMapProps): React.ReactElement {
  const regionsById = useMemo(() => {
    const m = new Map<string, ResolvedRegion>()
    for (const r of map.regions) m.set(r.regionId, r)
    return m
  }, [map.regions])

  const hoverActivePath = useMemo(
    () =>
      hoverRegionId == null ? null : (map.paths.find((p) => p.regionId === hoverRegionId) ?? null),
    [hoverRegionId, map.paths],
  )

  const pinnedPaths = useMemo(
    () => pinnedRegionIds.flatMap((id) => map.paths.filter((p) => p.regionId === id)),
    [pinnedRegionIds, map.paths],
  )

  return (
    <figure className="min-w-0 flex-1 space-y-1">
      <svg
        viewBox={map.viewBox}
        preserveAspectRatio="xMidYMid meet"
        overflow="visible"
        style={{ display: "block", height: "auto", width: "100%" }}
      >
        <g transform={map.transform ?? undefined}>
          {map.paths.map((path, i) => (
            <MapPath
              key={`${mapIndex}-${i}`}
              path={path}
              region={path.regionId ? (regionsById.get(path.regionId) ?? null) : null}
              mapIndex={mapIndex}
              onEnter={onEnter}
              onLeave={onLeave}
              onClick={onClick}
            />
          ))}
          <ActiveOverlay activePath={hoverActivePath} />
          {pinnedPaths.map((path) => (
            <path
              key={path.regionId}
              data-pinned-overlay=""
              className="pointer-events-none stroke-black dark:stroke-white"
              d={path.d}
              fill="none"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      </svg>
      {map.title && (
        <figcaption className="text-center text-sm font-medium">{map.title}</figcaption>
      )}
    </figure>
  )
}

function TooltipContent({ region }: { region: ResolvedRegion }) {
  return (
    <>
      <div className="font-medium">{region.label}</div>
      {region.formattedValue ? (
        <div className="text-xs opacity-85">{region.formattedValue}</div>
      ) : null}
    </>
  )
}

interface HoverTooltipProps {
  hoverRegion: { mapIndex: number; region: ResolvedRegion } | null
  cursor: { x: number; y: number } | null
}

function HoverTooltip({ hoverRegion, cursor }: HoverTooltipProps): React.ReactElement | null {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [mounted, setMounted] = useState(false)

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard isomorphic-portal mount guard
  useEffect(() => setMounted(true), [])

  useLayoutEffect(() => {
    if (!hoverRegion || !cursor || !ref.current) {
      setPos(null)
      return
    }
    const el = ref.current
    const tw = el.offsetWidth
    const th = el.offsetHeight
    let x = cursor.x + TOOLTIP_OFFSET
    let y = cursor.y + TOOLTIP_OFFSET
    if (x + tw > window.innerWidth - 8) x = cursor.x - tw - TOOLTIP_OFFSET
    if (y + th > window.innerHeight - 8) y = cursor.y - th - TOOLTIP_OFFSET
    setPos({ x, y })
  }, [hoverRegion, cursor])

  if (!mounted) return null

  const node = (
    <div
      ref={ref}
      className={cn(
        "bg-foreground text-background pointer-events-none fixed z-50 rounded-sm px-2.5 py-1.5 text-sm whitespace-nowrap shadow-md transition-opacity",
        hoverRegion && pos ? "opacity-100" : "opacity-0",
      )}
      role="tooltip"
      style={pos ? { left: pos.x, top: pos.y } : { left: -9999, top: -9999 }}
    >
      {hoverRegion ? <TooltipContent region={hoverRegion.region} /> : null}
    </div>
  )

  return createPortal(node, document.body)
}

interface PinnedTooltipItemProps {
  pinned: PinnedTooltip
}

function PinnedTooltipItem({ pinned }: PinnedTooltipItemProps): React.ReactElement | null {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [mounted, setMounted] = useState(false)

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard isomorphic-portal mount guard
  useEffect(() => setMounted(true), [])

  useLayoutEffect(() => {
    if (!ref.current) return
    const el = ref.current
    const tw = el.offsetWidth
    const th = el.offsetHeight
    let x = pinned.cursor.x + TOOLTIP_OFFSET
    let y = pinned.cursor.y + TOOLTIP_OFFSET
    if (x + tw > window.innerWidth - 8) x = pinned.cursor.x - tw - TOOLTIP_OFFSET
    if (y + th > window.innerHeight - 8) y = pinned.cursor.y - th - TOOLTIP_OFFSET
    setPos({ x, y })
  }, [pinned.cursor, mounted])

  if (!mounted) return null

  const node = (
    <div
      ref={ref}
      data-pinned-tooltip=""
      className={cn(
        "bg-foreground text-background pointer-events-none fixed z-50 rounded-sm px-2.5 py-1.5 text-sm whitespace-nowrap shadow-md transition-opacity",
        pos ? "opacity-100" : "opacity-0",
      )}
      role="tooltip"
      style={pos ? { left: pos.x, top: pos.y } : { left: -9999, top: -9999 }}
    >
      <TooltipContent region={pinned.region} />
    </div>
  )

  return createPortal(node, document.body)
}

export function InteractiveMapClient({
  layout,
  maps,
}: InteractiveMapClientProps): React.ReactElement {
  const widgetId = useId()
  const [pinned, setPinned] = useState<PinnedTooltip[]>([])
  const [hoverRegion, setHoverRegion] = useState<{
    mapIndex: number
    region: ResolvedRegion
  } | null>(null)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)

  const pinnedKeySet = useMemo(
    () => new Set(pinned.map((p) => `${p.mapIndex}:${p.region.regionId}`)),
    [pinned],
  )

  function handleEnter(mapIndex: number, region: ResolvedRegion) {
    if (pinnedKeySet.has(`${mapIndex}:${region.regionId}`)) return
    setHoverRegion({ mapIndex, region })
  }

  function handleLeave() {
    setHoverRegion(null)
  }

  function handleClick(mapIndex: number, region: ResolvedRegion, x: number, y: number) {
    const key = `${mapIndex}:${region.regionId}`
    if (pinnedKeySet.has(key)) {
      setPinned((prev) =>
        prev.filter((p) => !(p.mapIndex === mapIndex && p.region.regionId === region.regionId)),
      )
      setHoverRegion(null)
    } else {
      setPinned((prev) => [
        ...prev,
        { id: `${mapIndex}-${region.regionId}`, mapIndex, region, cursor: { x, y } },
      ])
      setHoverRegion(null)
    }
  }

  useEffect(() => {
    if (!hoverRegion) return
    const onMove = (e: PointerEvent) => setCursor({ x: e.clientX, y: e.clientY })
    window.addEventListener("pointermove", onMove)
    return () => window.removeEventListener("pointermove", onMove)
  }, [hoverRegion])

  const hasPins = pinned.length > 0

  useEffect(() => {
    if (!hasPins) return
    const onDocPointer = (e: PointerEvent) => {
      const target = e.target as Element | null
      if (target?.closest("[data-interactive-map-path]")) return
      setPinned([])
      setHoverRegion(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPinned([])
        setHoverRegion(null)
      }
    }
    document.addEventListener("pointerdown", onDocPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDocPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [hasPins])

  const layoutClass =
    layout === "grid"
      ? "grid grid-cols-1 gap-3 sm:grid-cols-2"
      : "flex flex-col gap-3 sm:flex-row sm:items-start"

  return (
    <div aria-label="Interactive map widget" className={layoutClass} role="group">
      {maps.map((map, mapIndex) => (
        <SingleMap
          key={`${widgetId}-${mapIndex}`}
          map={map}
          mapIndex={mapIndex}
          pinnedRegionIds={pinned
            .filter((p) => p.mapIndex === mapIndex)
            .map((p) => p.region.regionId)}
          hoverRegionId={hoverRegion?.mapIndex === mapIndex ? hoverRegion.region.regionId : null}
          onEnter={handleEnter}
          onLeave={handleLeave}
          onClick={handleClick}
        />
      ))}
      <HoverTooltip hoverRegion={hoverRegion} cursor={cursor} />
      {pinned.map((p) => (
        <PinnedTooltipItem key={p.id} pinned={p} />
      ))}
    </div>
  )
}
