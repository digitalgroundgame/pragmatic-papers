"use client"

import { useEffect, useState } from "react"

interface AnchorEntry {
  anchor: string
  children?: AnchorEntry[]
}

/** Used when the page sets no scroll padding */
const FALLBACK_LINE = 80
/** A heading scrolled to the line can land a fraction of a pixel below it */
const TOLERANCE = 2

function flattenAnchors(entries: AnchorEntry[]): string[] {
  const result: string[] = []
  function traverse(items: AnchorEntry[]) {
    for (const { anchor, children } of items) {
      if (anchor) result.push(anchor)
      if (children?.length) traverse(children)
    }
  }
  traverse(entries)
  return result
}

/**
 * Where an anchor link puts its heading: the html element's scroll padding, which
 * follows `--sticky-top`, so it grows while the ticker sticks under the header.
 */
export function activeLine(): number {
  const padding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)
  return (Number.isFinite(padding) ? padding : FALLBACK_LINE) + TOLERANCE
}

/** The last heading whose top has reached the line, or null above the first */
export function findActiveAnchor(elements: HTMLElement[], line: number): string | null {
  let active: string | null = null
  for (const el of elements) {
    if (el.getBoundingClientRect().top <= line) active = el.id
  }
  return active
}

export function useActiveAnchor(entries: AnchorEntry[], enabled = true): string | null {
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    const anchors = flattenAnchors(entries)
    if (!anchors.length) return

    const elements = anchors
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)

    if (!elements.length) return

    // The line moves when the ticker starts or stops sticking, so it's read on each
    // update rather than fixed in an IntersectionObserver's rootMargin.
    let frame = 0
    function update() {
      frame = 0
      const active = findActiveAnchor(elements, activeLine())
      setActiveAnchor((prev) => (prev === active ? prev : active))
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    window.addEventListener("hashchange", schedule)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
      window.removeEventListener("hashchange", schedule)
    }
  }, [entries, enabled])

  return activeAnchor
}
