"use client"

import { cn } from "@/utilities/utils"
import React, { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import type { ResolvedRegion } from "./types"

interface Location {
  x: number
  y: number
}

interface PinnedTooltip {
  id: string
  mapIndex: number
  region: ResolvedRegion
  cursor: Location
}
const TOOLTIP_OFFSET = 8

interface TooltipContentProps {
  region: ResolvedRegion
}

function TooltipContent({ region }: TooltipContentProps): React.ReactNode {
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
  cursor: Location | null
}

function HoverTooltip({ hoverRegion, cursor }: HoverTooltipProps): React.ReactNode {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<Location | null>(null)
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
      {hoverRegion && <TooltipContent region={hoverRegion.region} />}
    </div>
  )

  return createPortal(node, document.body)
}

interface PinnedTooltipItemProps {
  cursor: Location
  children?: React.ReactNode
}

function PinnedTooltip({ cursor, children }: PinnedTooltipItemProps): React.ReactElement | null {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<Location | null>(null)
  const [mounted, setMounted] = useState(false)

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard isomorphic-portal mount guard
  useEffect(() => setMounted(true), [])

  useLayoutEffect(() => {
    if (!ref.current) return
    const el = ref.current
    const tw = el.offsetWidth
    const th = el.offsetHeight
    let x = cursor.x + TOOLTIP_OFFSET
    let y = cursor.y + TOOLTIP_OFFSET
    if (x + tw > window.scrollX + window.innerWidth - 8) x = cursor.x - tw - TOOLTIP_OFFSET
    if (y + th > window.scrollY + window.innerHeight - 8) y = cursor.y - th - TOOLTIP_OFFSET
    setPos({ x, y })
  }, [cursor, mounted])

  if (!mounted) return null

  const node = (
    <div
      ref={ref}
      data-pinned-tooltip=""
      className={cn(
        "bg-foreground text-background pointer-events-none absolute z-50 rounded-sm px-2.5 py-1.5 text-sm whitespace-nowrap shadow-md transition-opacity",
        pos ? "opacity-100" : "opacity-0",
      )}
      role="tooltip"
      style={pos ? { left: pos.x, top: pos.y } : { left: -9999, top: -9999 }}
    >
      {children}
    </div>
  )

  return createPortal(node, document.body)
}

interface PinnedTooltipsProps {
  pinned: PinnedTooltip[]
}

function PinnedTooltipList({ pinned }: PinnedTooltipsProps): React.ReactNode {
  return (
    <>
      {pinned.map(({ id, cursor, region }) => (
        <PinnedTooltip key={id} cursor={cursor}>
          <TooltipContent region={region} />
        </PinnedTooltip>
      ))}
    </>
  )
}

export { HoverTooltip, PinnedTooltipList, type PinnedTooltip }
