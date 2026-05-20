"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/utilities/utils"
import { ArrowUpRight, Pause, Play } from "lucide-react"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { FeedSettingsMenu } from "./FeedSettingsMenu"
import type { AdSlot } from "./types"

interface AdSlotViewProps {
  ad: AdSlot
  active: boolean
  autoPlayEnabled: boolean
  userAutoPlayEnabled: boolean
  onAutoPlayToggle: () => void
  onEndReached: () => void
}

const AD_DURATION_MS = 6000
const TAP_MAX_MOVE_PX = 8
const TAP_MAX_MS = 350
const TAP_INDICATOR_MS = 600
const INTERACTIVE_SEL = 'button, a, [role="tab"], [role="button"], input, textarea, select, label'

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
}

export function AdSlotView({
  ad,
  active,
  autoPlayEnabled,
  userAutoPlayEnabled,
  onAutoPlayToggle,
  onEndReached,
}: AdSlotViewProps): React.ReactNode {
  const [progress, setProgress] = useState(0)
  const [showTapIndicator, setShowTapIndicator] = useState(false)
  const onEndReachedRef = useRef(onEndReached)
  const onAutoPlayToggleRef = useRef(onAutoPlayToggle)
  const elapsedRef = useRef(0)

  useEffect(() => {
    onEndReachedRef.current = onEndReached
  }, [onEndReached])
  useEffect(() => {
    onAutoPlayToggleRef.current = onAutoPlayToggle
  }, [onAutoPlayToggle])

  // Reset visible progress synchronously when this slot's identity or
  // activeness changes so the first painted frame doesn't carry stale fill.
  // The mutable `elapsedRef` follows in an effect (refs must not be touched
  // during render).
  const [lastResetKey, setLastResetKey] = useState<{ id: string; active: boolean }>({
    id: ad.id,
    active,
  })
  if (lastResetKey.id !== ad.id || lastResetKey.active !== active) {
    setLastResetKey({ id: ad.id, active })
    if (progress !== 0) setProgress(0)
  }
  useEffect(() => {
    elapsedRef.current = 0
  }, [ad.id, active])

  useEffect(() => {
    if (!active || !autoPlayEnabled || prefersReducedMotion()) return

    let lastFrame: number | null = null
    let rafId = 0
    const tick = (now: number): void => {
      if (lastFrame !== null) elapsedRef.current += now - lastFrame
      lastFrame = now
      const next = Math.min(1, elapsedRef.current / AD_DURATION_MS)
      setProgress(next)
      if (next >= 1) {
        rafId = 0
        onEndReachedRef.current()
        return
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => {
      if (rafId !== 0) cancelAnimationFrame(rafId)
    }
  }, [active, autoPlayEnabled])

  useEffect(() => {
    if (!showTapIndicator) return
    const id = window.setTimeout(() => setShowTapIndicator(false), TAP_INDICATOR_MS)
    return () => window.clearTimeout(id)
  }, [showTapIndicator])

  const swipeStartRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    swipeStartRef.current = { x: e.clientX, y: e.clientY, t: Date.now() }
  }, [])
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const start = swipeStartRef.current
    swipeStartRef.current = null
    if (!start) return
    const dx = Math.abs(start.x - e.clientX)
    const dy = Math.abs(start.y - e.clientY)
    const dt = Date.now() - start.t
    if (dx < TAP_MAX_MOVE_PX && dy < TAP_MAX_MOVE_PX && dt < TAP_MAX_MS) {
      const target = e.target as Element | null
      if (target && target.closest(INTERACTIVE_SEL)) return
      onAutoPlayToggleRef.current()
      setShowTapIndicator(true)
    }
  }, [])

  const isExternal = ad.ctaHref.startsWith("http")

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-black"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        swipeStartRef.current = null
      }}
    >
      <div
        className={cn(
          "absolute inset-0",
          ad.variant === "donation" && "from-brand/60 bg-gradient-to-br to-black",
          ad.variant === "promo" && "from-primary/40 bg-gradient-to-br to-black",
          ad.variant === "external" && "bg-gradient-to-br from-slate-700 to-black",
        )}
        aria-hidden="true"
      />

      <div
        className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 80px)",
          paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
        }}
      >
        <p className="font-sans text-xs tracking-[0.2em] text-white/70 uppercase">{ad.eyebrow}</p>
        <h2 className="font-display mt-3 text-3xl leading-tight text-white sm:text-4xl">
          {ad.title}
        </h2>
        <p className="mt-3 max-w-md font-serif text-base leading-snug text-white/85">{ad.body}</p>
        <Button
          className="mt-6 rounded-full px-6"
          variant="default"
          render={
            <a
              href={ad.ctaHref}
              target={isExternal ? "_blank" : undefined}
              rel={isExternal ? "noopener noreferrer" : undefined}
            >
              {ad.ctaLabel}
              {isExternal && <ArrowUpRight className="ml-1 size-4" />}
            </a>
          }
        />
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 px-3"
        style={{ paddingTop: "max(env(safe-area-inset-top), 8px)" }}
      >
        <div className="pointer-events-auto flex h-3 w-full items-center px-px">
          <span className="block h-1 w-full overflow-hidden rounded-full bg-white/25">
            <span
              className="block h-full origin-left rounded-full bg-white"
              style={{ transform: `scaleX(${progress})` }}
            />
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p
              className="truncate font-sans text-[12px] tracking-wide text-white/70 uppercase"
              style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}
            >
              {ad.eyebrow}
            </p>
          </div>
          <div className="pointer-events-auto shrink-0">
            <FeedSettingsMenu />
          </div>
        </div>
      </div>

      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-30 flex items-center justify-center transition-opacity duration-200",
          showTapIndicator ? "opacity-100" : "opacity-0",
        )}
        aria-hidden="true"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-black/55 backdrop-blur-md">
          {userAutoPlayEnabled ? (
            <Play className="size-8 text-white" fill="currentColor" />
          ) : (
            <Pause className="size-8 text-white" fill="currentColor" />
          )}
        </div>
      </div>
    </div>
  )
}
