"use client"

import { cn } from "@/utilities/utils"
import React, { useRef } from "react"

interface PageProgressProps {
  total: number
  activeIndex: number
  progress: number
  onJump: (index: number) => void
}

export function PageProgress({
  total,
  activeIndex,
  progress,
  onJump,
}: PageProgressProps): React.ReactNode {
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([])

  if (total <= 1) return null

  // Roving focus: only the active segment is in the tab order, so the arrow
  // keys (and Home/End) move between pages, taking focus along.
  const onKeyDown = (e: React.KeyboardEvent): void => {
    const target =
      e.key === "ArrowRight"
        ? activeIndex + 1
        : e.key === "ArrowLeft"
          ? activeIndex - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? total - 1
              : null
    if (target === null) return
    e.preventDefault()
    const next = Math.max(0, Math.min(total - 1, target))
    if (next === activeIndex) return
    onJump(next)
    tabsRef.current[next]?.focus()
  }

  return (
    <div
      className="flex w-full items-center gap-1"
      role="tablist"
      aria-label="Article pages"
      onKeyDown={onKeyDown}
    >
      {Array.from({ length: total }, (_, i) => {
        const fill = i < activeIndex ? 1 : i === activeIndex ? progress : 0
        const isActive = i === activeIndex
        return (
          <button
            key={i}
            ref={(el) => {
              tabsRef.current[i] = el
            }}
            type="button"
            role="tab"
            aria-label={`Go to page ${i + 1} of ${total}`}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onJump(i)}
            className="group flex h-3 flex-1 cursor-pointer items-center px-px"
          >
            <span className="block h-1 w-full overflow-hidden rounded-full bg-white/25">
              <span
                data-testid="page-progress-fill"
                className={cn(
                  "block h-full origin-left rounded-full bg-white",
                  // Smooth fills for past/future segments; the active one is driven by
                  // RAF and updates frequently enough that an additional transition
                  // would lag the rendered position.
                  !isActive && "transition-transform duration-200 ease-out",
                )}
                style={{ transform: `scaleX(${fill})` }}
              />
            </span>
          </button>
        )
      })}
    </div>
  )
}
