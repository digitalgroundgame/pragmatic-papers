"use client"

import { useEffect, useRef, useState } from "react"
import type { FeedPageMeta } from "../types"

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
  page: FeedPageMeta | undefined
  onAdvance: () => void
}): { progress: number } {
  const [progress, setProgress] = useState(0)
  // `lastResetKey` tracks the (page, active) identity so we can flush
  // `progress` synchronously to 0 when the user lands on a new page —
  // before the RAF-driven update can paint a frame of stale fill.
  // See https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [lastResetKey, setLastResetKey] = useState<{
    page: FeedPageMeta | undefined
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

    const duration = page.durationMs

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
