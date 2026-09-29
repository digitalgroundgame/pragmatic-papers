"use client"

import { useEffect, useState } from "react"

interface AnchorEntry {
  anchor: string
  children?: AnchorEntry[]
}

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

export function useActiveAnchor(
  entries: AnchorEntry[],
  offset = 120,
  enabled = true,
): string | null {
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    const anchors = flattenAnchors(entries)
    if (!anchors.length) return

    const elements = anchors
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)

    if (!elements.length) return

    function computeFromPositions() {
      let active: string | null = null
      for (const el of elements) {
        if (el.getBoundingClientRect().top <= offset) active = el.id
      }
      setActiveAnchor((prev) => (prev === active ? prev : active))
    }

    // threshold [0, 1] fires at both the top and bottom of the heading crossing
    // the detection zone, so the active anchor updates as soon as the heading's
    // top reaches the offset line rather than waiting for its bottom.
    const observer = new IntersectionObserver(computeFromPositions, {
      rootMargin: `-${offset}px 0px 0px 0px`,
      threshold: [0, 1],
    })

    elements.forEach((el) => observer.observe(el))
    // hashchange handles anchor-link navigation where the heading jumps from
    // below the viewport to above the detection zone in a single frame,
    // which IntersectionObserver won't detect as a threshold crossing.
    window.addEventListener("hashchange", computeFromPositions)
    return () => {
      observer.disconnect()
      window.removeEventListener("hashchange", computeFromPositions)
    }
  }, [entries, offset, enabled])

  return activeAnchor
}
