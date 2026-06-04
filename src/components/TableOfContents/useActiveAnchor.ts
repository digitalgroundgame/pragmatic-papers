"use client"

import { useEffect, useState } from "react"

interface AnchorEntry {
  anchor: string
  children?: AnchorEntry[]
}

export function useActiveAnchor(entries: AnchorEntry[], offset = 120): string | null {
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null)

  useEffect(() => {
    function updateActive() {
      let active: string | null = null
      function traverse(items: AnchorEntry[]) {
        for (const { anchor, children } of items) {
          const el = anchor ? document.getElementById(anchor) : null
          if (el && el.getBoundingClientRect().top <= offset) active = anchor
          if (children?.length) traverse(children)
        }
      }
      traverse(entries)
      setActiveAnchor(active)
    }

    window.addEventListener("scroll", updateActive, { passive: true })
    updateActive()
    return () => window.removeEventListener("scroll", updateActive)
  }, [entries, offset])

  return activeAnchor
}
