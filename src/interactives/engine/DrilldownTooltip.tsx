"use client"

import React, { useEffect, useImperativeHandle, useRef, useState } from "react"
import { createPortal } from "react-dom"

export interface TooltipTarget {
  label: string
  summary: string | null
}

export interface DrilldownTooltipHandle {
  /** What the pointer is over and where it is, or nulls when it is over nothing. */
  point(target: TooltipTarget | null, at: { x: number; y: number } | null): void
}

const OFFSET = 12
/** Clearance kept between the tooltip and the edge of the window. */
const EDGE = 8

/**
 * Cursor-following, viewport-clamped tooltip: the hovered region's label and its one-line
 * summary. The full facts live in the pane, where they can be read at leisure — repeating
 * them here made the tooltip a wall of text that covered the map.
 *
 * Driven through a handle rather than through props, and that is the whole point of it. A
 * pointer crossing the map reports itself far more often than the screen is painted; as state
 * that was a render of the map, the rail, the selector and the pane per report, and a second
 * render each time for the position measured afterwards. Nothing above changes when a cursor
 * moves two pixels, so nothing above re-renders: the text goes to the nodes and the position
 * to a transform, once a frame, and React is left out of it.
 */
export function DrilldownTooltip({
  ref,
}: {
  ref?: React.Ref<DrilldownTooltipHandle>
}): React.ReactNode {
  const box = useRef<HTMLDivElement | null>(null)
  const labelEl = useRef<HTMLDivElement | null>(null)
  const summaryEl = useRef<HTMLDivElement | null>(null)
  const [mounted, setMounted] = useState(false)
  /** The frame a write is queued for, and what it will say when it runs. */
  const frame = useRef<number | null>(null)
  const next = useRef<{ target: TooltipTarget | null; at: { x: number; y: number } | null }>({
    target: null,
    at: null,
  })
  /** The size last measured. It only changes when the text does, so following costs no layout. */
  const size = useRef({ w: 0, h: 0 })
  const saying = useRef<string | null>(null)

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard isomorphic-portal mount guard
  useEffect(() => setMounted(true), [])

  useImperativeHandle(ref, () => ({
    point(target, at) {
      next.current = { target, at }
      if (frame.current !== null) return
      frame.current = requestAnimationFrame(() => {
        frame.current = null
        const el = box.current
        if (!el) return
        const { target: t, at: p } = next.current
        const key = t ? `${t.label}\u0000${t.summary ?? ""}` : null
        if (t && key !== saying.current) {
          saying.current = key
          if (labelEl.current) labelEl.current.textContent = t.label
          if (summaryEl.current) {
            summaryEl.current.textContent = t.summary ?? ""
            summaryEl.current.hidden = !t.summary
          }
          size.current = { w: el.offsetWidth, h: el.offsetHeight }
        }
        el.toggleAttribute("data-visible", !!(t && p))
        // Keep the last position when the hover ends. The tooltip fades rather than vanishing,
        // and a fade that also jumps to the parking spot is a flick across the map on every
        // click — choosing a region is exactly when the pointer stops moving and the hover
        // goes away.
        if (!t || !p) return
        const { w, h } = size.current
        const x = p.x + OFFSET + w > window.innerWidth - EDGE ? p.x - w - OFFSET : p.x + OFFSET
        const y = p.y + OFFSET + h > window.innerHeight - EDGE ? p.y - h - OFFSET : p.y + OFFSET
        el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`
      })
    },
  }))

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    },
    [],
  )

  if (!mounted) return null

  return createPortal(
    <div
      ref={box}
      data-drilldown-tooltip=""
      role="tooltip"
      // Parked off-screen until it has somewhere to be; after that it stays where it last was,
      // faded out, rather than returning to the corner.
      style={{ transform: "translate3d(-9999px, -9999px, 0)" }}
      className="bg-foreground text-background pointer-events-none fixed top-0 left-0 z-50 max-w-64 rounded-sm px-3 py-2 text-sm opacity-0 shadow-md transition-opacity data-visible:opacity-100"
    >
      <div ref={labelEl} className="font-semibold" />
      <div ref={summaryEl} hidden className="text-xs opacity-85" />
    </div>,
    document.body,
  )
}
