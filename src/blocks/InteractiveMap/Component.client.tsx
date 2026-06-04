"use client"

import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"

import type { ResolvedMap, ResolvedPath, ResolvedRegion } from "@/blocks/InteractiveMap/types"
import { cn } from "@/utilities/utils"

interface InteractiveMapClientProps {
  layout: string
  maps: ResolvedMap[]
}

interface HoverTarget {
  mapIndex: number
  region: ResolvedRegion
  path: ResolvedPath
  pinned: boolean
}

const TOOLTIP_OFFSET = 14

interface SingleMapProps {
  map: ResolvedMap
  mapIndex: number
  activeRegionId: string | null
  onEnter: (mapIndex: number, region: ResolvedRegion, path: ResolvedPath) => void
  onLeave: () => void
  onPin: (mapIndex: number, region: ResolvedRegion, path: ResolvedPath) => void
}

function SingleMap({
  map,
  mapIndex,
  activeRegionId,
  onEnter,
  onLeave,
  onPin,
}: SingleMapProps): React.ReactElement {
  const regionsById = useMemo(() => {
    const m = new Map<string, ResolvedRegion>()
    for (const r of map.regions) m.set(r.regionId, r)
    return m
  }, [map.regions])

  const activePath = useMemo(
    () =>
      activeRegionId == null
        ? null
        : (map.paths.find((p) => p.regionId === activeRegionId) ?? null),
    [activeRegionId, map.paths],
  )

  const renderPath = (path: ResolvedPath, i: number): React.ReactElement => {
    const region = path.regionId == null ? null : (regionsById.get(path.regionId) ?? null)
    const fill = region?.color
    const accessibleLabel = region
      ? region.formattedValue
        ? `${region.label}: ${region.formattedValue}`
        : region.label
      : (path.regionId ?? "")
    const interactive = region != null

    return (
      <path
        key={`${mapIndex}-${i}`}
        d={path.d}
        fill={fill}
        stroke="#ffffff"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        tabIndex={interactive ? 0 : undefined}
        data-interactive-map-path={interactive ? "" : undefined}
        style={interactive ? { cursor: "pointer", outline: "none" } : undefined}
        onPointerEnter={interactive && region ? () => onEnter(mapIndex, region, path) : undefined}
        onPointerLeave={interactive ? onLeave : undefined}
        onFocus={interactive && region ? () => onEnter(mapIndex, region, path) : undefined}
        onBlur={interactive ? onLeave : undefined}
        onClick={interactive && region ? () => onPin(mapIndex, region, path) : undefined}
        onKeyDown={
          interactive && region
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onPin(mapIndex, region, path)
                }
              }
            : undefined
        }
      >
        {accessibleLabel ? <title>{accessibleLabel}</title> : null}
      </path>
    )
  }

  const content = (
    <>
      {map.paths.map(renderPath)}
      <path
        className="pointer-events-none"
        d={activePath?.d ?? ""}
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        vectorEffect="non-scaling-stroke"
        style={{ visibility: activePath ? "visible" : "hidden" }}
      />
    </>
  )

  return (
    <figure className="min-w-0 flex-1">
      {map.title ? (
        <figcaption className="mb-1 text-center text-sm font-medium">{map.title}</figcaption>
      ) : null}
      <svg
        viewBox={map.viewBox}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block", height: "auto", width: "100%" }}
      >
        {map.transform ? <g transform={map.transform}>{content}</g> : content}
      </svg>
    </figure>
  )
}

interface TooltipProps {
  cursor: { x: number; y: number } | null
  hover: HoverTarget | null
}

function Tooltip({ cursor, hover }: TooltipProps): React.ReactElement | null {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [mounted, setMounted] = useState(false)

  // Portals need a DOM target, so we wait one render after hydration to mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard isomorphic-portal mount guard
  useEffect(() => setMounted(true), [])

  useLayoutEffect(() => {
    if (!hover || !cursor || !ref.current) {
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
  }, [hover, cursor])

  if (!mounted) return null

  const node = (
    <div
      ref={ref}
      className={cn(
        "bg-foreground text-background pointer-events-none fixed z-50 rounded-sm px-2.5 py-1.5 text-sm whitespace-nowrap shadow-md transition-opacity",
        hover && pos ? "opacity-100" : "opacity-0",
      )}
      role="tooltip"
      style={pos ? { left: pos.x, top: pos.y } : { left: -9999, top: -9999 }}
    >
      {hover ? (
        <>
          <div className="font-medium">{hover.region.label}</div>
          {hover.region.formattedValue ? (
            <div className="text-xs opacity-85">{hover.region.formattedValue}</div>
          ) : null}
        </>
      ) : null}
    </div>
  )

  return createPortal(node, document.body)
}

export function InteractiveMapClient({
  layout,
  maps,
}: InteractiveMapClientProps): React.ReactElement {
  const widgetId = useId()
  const [hover, setHover] = useState<HoverTarget | null>(null)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)

  const handleEnter = useCallback(
    (mapIndex: number, region: ResolvedRegion, path: ResolvedPath) => {
      setHover((prev) => (prev?.pinned ? prev : { mapIndex, region, path, pinned: false }))
    },
    [],
  )

  const handleLeave = useCallback(() => {
    setHover((prev) => (prev?.pinned ? prev : null))
  }, [])

  const handlePin = useCallback((mapIndex: number, region: ResolvedRegion, path: ResolvedPath) => {
    setHover({ mapIndex, region, path, pinned: true })
  }, [])

  useEffect(() => {
    if (!hover) return
    const onMove = (e: PointerEvent) => setCursor({ x: e.clientX, y: e.clientY })
    window.addEventListener("pointermove", onMove)
    return () => window.removeEventListener("pointermove", onMove)
  }, [hover])

  useEffect(() => {
    if (!hover?.pinned) return
    const onDocPointer = (e: PointerEvent) => {
      const target = e.target as Element | null
      if (target?.closest("[data-interactive-map-path]")) return
      setHover(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHover(null)
    }
    document.addEventListener("pointerdown", onDocPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDocPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [hover?.pinned])

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
          activeRegionId={hover?.mapIndex === mapIndex ? hover.region.regionId : null}
          onEnter={handleEnter}
          onLeave={handleLeave}
          onPin={handlePin}
        />
      ))}
      <Tooltip cursor={cursor} hover={hover} />
    </div>
  )
}
