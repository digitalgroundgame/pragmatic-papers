"use client"

import { useEffect, useRef, useState } from "react"
import { getFeedBlockBehavior } from "../blocks/registry"
import type { ArticlePageItem } from "../types"

const WPM = 220
const MIN_MS = 3500
const HERO_MS = 4500
const BLOCK_MS = 6000
const THANKS_MS = 6000

export function getPageDurationMs(page: ArticlePageItem): number {
  switch (page.kind) {
    case "hero":
      return HERO_MS
    case "content": {
      const fromWords = (page.wordCount / WPM) * 60_000
      return Math.max(MIN_MS, fromWords)
    }
    case "block":
      return getFeedBlockBehavior(page.blockType).durationMs ?? BLOCK_MS
    case "thanks":
      return THANKS_MS
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
  // `lastResetKey` tracks the (page, active) identity so we can flush
  // `progress` synchronously to 0 when the user lands on a new page —
  // before the RAF-driven update can paint a frame of stale fill.
  // See https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [lastResetKey, setLastResetKey] = useState<{
    page: ArticlePageItem | undefined
    active: boolean
  }>({ page, active })
  if (lastResetKey.page !== page || lastResetKey.active !== active) {
    setLastResetKey({ page, active })
    if (progress !== 0) setProgress(0)
  }

  const elapsedRef = useRef(0)
  const onAdvanceRef = useRef(onAdvance)

  // Keep the latest onAdvance reachable from the RAF tick without restarting the timer.
  useEffect(() => {
    onAdvanceRef.current = onAdvance
  }, [onAdvance])

  // Reset accumulated time when the user lands on a new page or leaves/enters
  // this article. Toggling `enabled` alone (pause/resume) must NOT reset.
  useEffect(() => {
    elapsedRef.current = 0
  }, [page, active])

  useEffect(() => {
    if (!page) return

    const duration = getPageDurationMs(page)

    if (!active || !enabled || prefersReducedMotion()) {
      // Paused — sync the displayed progress to the preserved elapsed value and stop.
      const id = requestAnimationFrame(() =>
        setProgress(Math.min(1, elapsedRef.current / duration)),
      )
      return () => cancelAnimationFrame(id)
    }

    let lastFrame: number | null = null
    let rafId = 0
    const tick = (now: number): void => {
      if (lastFrame !== null) {
        elapsedRef.current += now - lastFrame
      }
      lastFrame = now
      const next = Math.min(1, elapsedRef.current / duration)
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
