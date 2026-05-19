"use client"

import { useEffect, useRef, useState } from "react"
import type { ArticlePageItem } from "../types"

const WPM = 220
const MIN_MS = 3500
const HERO_MS = 4500
const BLOCK_MS = 6000
const HEAVY_BLOCK_MS = 8000
const HEAVY_BLOCK_TYPES = new Set(["socialEmbed", "timeline", "mediaCollage"])

export function getPageDurationMs(page: ArticlePageItem): number {
  switch (page.kind) {
    case "hero":
      return HERO_MS
    case "content": {
      const fromWords = (page.wordCount / WPM) * 60_000
      return Math.max(MIN_MS, fromWords)
    }
    case "block":
      return HEAVY_BLOCK_TYPES.has(page.blockType) ? HEAVY_BLOCK_MS : BLOCK_MS
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
}

export function useAutoPlay({
  active,
  enabled,
  page,
  onAdvance,
}: {
  active: boolean
  enabled: boolean
  page: ArticlePageItem | undefined
  onAdvance: () => void
}): { progress: number } {
  const [progress, setProgress] = useState(0)
  const onAdvanceRef = useRef(onAdvance)

  // Keep the latest onAdvance accessible from the RAF tick without restarting the timer.
  useEffect(() => {
    onAdvanceRef.current = onAdvance
  }, [onAdvance])

  useEffect(() => {
    if (!active || !enabled || !page || prefersReducedMotion()) {
      // Subscribing to "no animation" means we want a clean 0 state. Schedule it
      // as an effect outcome so we don't violate the set-state-in-effect rule.
      const id = requestAnimationFrame(() => setProgress(0))
      return () => cancelAnimationFrame(id)
    }

    const duration = getPageDurationMs(page)
    const start = performance.now()
    let rafId = 0

    const tick = (now: number): void => {
      const elapsed = now - start
      const next = Math.min(1, elapsed / duration)
      setProgress(next)
      if (next >= 1) {
        rafId = 0
        onAdvanceRef.current()
        return
      }
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => {
      if (rafId !== 0) cancelAnimationFrame(rafId)
    }
  }, [active, enabled, page])

  return { progress }
}
