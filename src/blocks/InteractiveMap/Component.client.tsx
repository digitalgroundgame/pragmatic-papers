"use client"

import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"

import type { ResolvedMap, ResolvedRegion } from "@/blocks/InteractiveMap/types"
import { cn } from "@/utilities/utils"

interface InteractiveMapClientProps {
  layout: string
  maps: ResolvedMap[]
}

interface HoverState {
  region: ResolvedRegion
  pinned: boolean
}

const TOOLTIP_OFFSET = 14

interface SingleMapProps {
  map: ResolvedMap
  activeRegionId: string | null
  onEnter: (region: ResolvedRegion) => void
  onLeave: () => void
  onPin: (region: ResolvedRegion) => void
}

function SingleMap({ map, activeRegionId, onEnter, onLeave, onPin }: SingleMapProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const overlayRef = useRef<SVGPathElement | null>(null)
  const regionsById = useMemo(() => {
    const m = new Map<string, ResolvedRegion>()
    for (const r of map.regions) m.set(r.regionId, r)
    return m
  }, [map.regions])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const svg = wrap.querySelector("svg")
    if (!svg) return

    const vb = svg.viewBox?.baseVal
    if (vb && vb.width && vb.height) {
      svg.setAttribute(
        "preserveAspectRatio",
        svg.getAttribute("preserveAspectRatio") ?? "xMidYMid meet",
      )
      svg.style.aspectRatio = `${vb.width} / ${vb.height}`
    }
    svg.removeAttribute("width")
    svg.removeAttribute("height")
    svg.style.width = "100%"
    svg.style.height = "auto"
    svg.style.display = "block"

    const attrName = map.regionAttribute
    const paths = Array.from(svg.querySelectorAll<SVGPathElement>(`path[${attrName}]`))

    for (const path of paths) {
      const id = path.getAttribute(attrName)
      if (!id) continue
      const region = regionsById.get(id)
      if (region) {
        path.style.fill = region.color
      }
      path.setAttribute("data-interactive-map-path", "")
      path.setAttribute("tabindex", "0")
      path.style.cursor = "pointer"
      path.style.outline = "none"
      const titleEl = path.querySelector("title")
      const accessibleLabel = region
        ? region.formattedValue
          ? `${region.label}: ${region.formattedValue}`
          : region.label
        : id
      if (titleEl) {
        titleEl.textContent = accessibleLabel
      } else {
        const t = document.createElementNS("http://www.w3.org/2000/svg", "title")
        t.textContent = accessibleLabel
        path.appendChild(t)
      }
    }

    const g = svg.querySelector("g") ?? svg
    const overlay = document.createElementNS("http://www.w3.org/2000/svg", "path")
    overlay.setAttribute("fill", "none")
    overlay.setAttribute("stroke", "currentColor")
    overlay.setAttribute("stroke-width", "3")
    overlay.setAttribute("vector-effect", "non-scaling-stroke")
    overlay.setAttribute("pointer-events", "none")
    overlay.style.visibility = "hidden"
    g.appendChild(overlay)
    overlayRef.current = overlay

    const handleEnter = (e: Event) => {
      const target = e.currentTarget as SVGPathElement
      const id = target.getAttribute(attrName)
      if (!id) return
      const region = regionsById.get(id)
      if (!region) return
      onEnter(region)
      overlay.setAttribute("d", target.getAttribute("d") ?? "")
      overlay.style.visibility = "visible"
    }
    const handleLeave = () => {
      onLeave()
      overlay.style.visibility = "hidden"
    }
    const handleClick = (e: Event) => {
      const target = e.currentTarget as SVGPathElement
      const id = target.getAttribute(attrName)
      if (!id) return
      const region = regionsById.get(id)
      if (!region) return
      onPin(region)
      overlay.setAttribute("d", target.getAttribute("d") ?? "")
      overlay.style.visibility = "visible"
    }
    const handleKey = (e: Event) => {
      const ke = e as unknown as KeyboardEvent
      if (ke.key !== "Enter" && ke.key !== " ") return
      ke.preventDefault()
      handleClick(e)
    }
    const handleFocus = (e: Event) => handleEnter(e)

    for (const path of paths) {
      path.addEventListener("pointerenter", handleEnter)
      path.addEventListener("pointerleave", handleLeave)
      path.addEventListener("focus", handleFocus)
      path.addEventListener("blur", handleLeave)
      path.addEventListener("click", handleClick)
      path.addEventListener("keydown", handleKey)
    }

    return () => {
      for (const path of paths) {
        path.removeEventListener("pointerenter", handleEnter)
        path.removeEventListener("pointerleave", handleLeave)
        path.removeEventListener("focus", handleFocus)
        path.removeEventListener("blur", handleLeave)
        path.removeEventListener("click", handleClick)
        path.removeEventListener("keydown", handleKey)
      }
      overlay.remove()
      overlayRef.current = null
    }
  }, [map.regionAttribute, regionsById, onEnter, onLeave, onPin])

  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    if (!activeRegionId) {
      overlay.style.visibility = "hidden"
    }
  }, [activeRegionId])

  return (
    <figure className="min-w-0 flex-1">
      {map.title ? (
        <figcaption className="mb-1 text-center text-sm font-medium">{map.title}</figcaption>
      ) : null}
      {/* eslint-disable-next-line react/no-danger -- SVG is sanitized server-side via sanitize-html with a strict allowlist */}
      <div ref={wrapRef} dangerouslySetInnerHTML={{ __html: map.svg }} />
    </figure>
  )
}

export function InteractiveMapClient({
  layout,
  maps,
}: InteractiveMapClientProps): React.ReactElement {
  const widgetId = useId()
  const [hover, setHover] = useState<HoverState | null>(null)
  const cursorRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const tooltipRef = useRef<HTMLDivElement | null>(null)

  const positionTooltip = () => {
    const el = tooltipRef.current
    if (!el) return
    const { x: cx, y: cy } = cursorRef.current
    const tw = el.offsetWidth
    const th = el.offsetHeight
    let x = cx + TOOLTIP_OFFSET
    let y = cy + TOOLTIP_OFFSET
    if (x + tw > window.innerWidth - 8) x = cx - tw - TOOLTIP_OFFSET
    if (y + th > window.innerHeight - 8) y = cy - th - TOOLTIP_OFFSET
    el.style.left = `${x}px`
    el.style.top = `${y}px`
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      cursorRef.current = { x: e.clientX, y: e.clientY }
      if (hover) positionTooltip()
    }
    window.addEventListener("pointermove", onMove)
    return () => window.removeEventListener("pointermove", onMove)
  }, [hover])

  useLayoutEffect(() => {
    if (hover) positionTooltip()
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
      {maps.map((map, i) => (
        <SingleMap
          key={`${widgetId}-${i}`}
          map={map}
          activeRegionId={hover?.region.regionId ?? null}
          onEnter={(region) => setHover({ region, pinned: false })}
          onLeave={() => setHover((h) => (h?.pinned ? h : null))}
          onPin={(region) => setHover({ region, pinned: true })}
        />
      ))}
      <div
        ref={tooltipRef}
        className={cn(
          "bg-foreground text-background pointer-events-none fixed z-50 rounded-sm px-2.5 py-1.5 text-sm whitespace-nowrap shadow-md transition-opacity",
          hover ? "opacity-100" : "opacity-0",
        )}
        role="tooltip"
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
    </div>
  )
}
