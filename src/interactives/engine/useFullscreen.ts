"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * The browser owns fullscreen state — Escape and F11 leave without asking us — so it is read
 * from the document rather than remembered here.
 */
export function useFullscreen(rootRef: React.RefObject<HTMLDivElement | null>): {
  full: boolean
  toggleFull: () => void
} {
  const [full, setFull] = useState(false)
  useEffect(() => {
    const sync = (): void => setFull(document.fullscreenElement === rootRef.current)
    document.addEventListener("fullscreenchange", sync)
    return () => document.removeEventListener("fullscreenchange", sync)
  }, [rootRef])
  const toggleFull = useCallback(() => {
    const el = rootRef.current
    if (!el) return
    // A rejection means the browser said no, which is its right, and the button not moving
    // says so.
    if (document.fullscreenElement === el) void document.exitFullscreen?.().catch(() => undefined)
    else void el.requestFullscreen?.().catch(() => undefined)
  }, [rootRef])
  return { full, toggleFull }
}
