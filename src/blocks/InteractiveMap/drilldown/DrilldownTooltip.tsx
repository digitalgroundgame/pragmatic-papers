"use client"

import React, { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { cn } from "@/utilities/utils"

interface DrilldownTooltipProps {
  label: string | null
  summary: string | null
  cursor: { x: number; y: number } | null
}

const OFFSET = 12

/**
 * Cursor-following, viewport-clamped tooltip: the hovered region's label and its one-line
 * summary. The full facts live in the pane, where they can be read at leisure — repeating
 * them here made the tooltip a wall of text that covered the map.
 */
export function DrilldownTooltip({
  label,
  summary,
  cursor,
}: DrilldownTooltipProps): React.ReactNode {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [mounted, setMounted] = useState(false)

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard isomorphic-portal mount guard
  useEffect(() => setMounted(true), [])

  useLayoutEffect(() => {
    if (!label || !cursor || !ref.current) {
      setPos(null)
      return
    }
    const el = ref.current
    let x = cursor.x + OFFSET
    let y = cursor.y + OFFSET
    if (x + el.offsetWidth > window.innerWidth - 8) x = cursor.x - el.offsetWidth - OFFSET
    if (y + el.offsetHeight > window.innerHeight - 8) y = cursor.y - el.offsetHeight - OFFSET
    setPos({ x, y })
  }, [label, summary, cursor])

  if (!mounted) return null

  return createPortal(
    <div
      ref={ref}
      data-drilldown-tooltip=""
      role="tooltip"
      className={cn(
        "bg-foreground text-background pointer-events-none fixed z-50 max-w-64 rounded-md px-3 py-2 text-sm shadow-md transition-opacity",
        label && pos ? "opacity-100" : "opacity-0",
      )}
      style={pos ? { left: pos.x, top: pos.y } : { left: -9999, top: -9999 }}
    >
      {label && (
        <>
          <div className="font-semibold">{label}</div>
          {summary && <div className="text-xs opacity-85">{summary}</div>}
        </>
      )}
    </div>,
    document.body,
  )
}
