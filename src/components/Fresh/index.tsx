"use client"

import React, { useCallback } from "react"

import { cn } from "@/utilities/utils"

import type { FreshName } from "./names"
import { markSeen, useIsUnseen } from "./store"

export { FRESH, type FreshName } from "./names"

interface FreshProps {
  /** What is fresh. The dot shows until something calls `markSeen` for the same name. */
  name: FreshName
  className?: string
}

/**
 * A small dot marking something fresh, a feature or piece of content the reader
 * hasn't seen yet, in the top-right corner of the nearest `relative` ancestor.
 * It shows until the reader has seen `name`. Clearing it is up to what it points
 * at: call `useFresh(name).markSeen` where the reader interacts with it.
 * Renders nothing on the server, so it never causes a hydration mismatch.
 */
export function Fresh({ name, className }: FreshProps): React.ReactNode {
  if (!useIsUnseen(name)) return null
  return (
    <span
      aria-hidden="true"
      data-slot="fresh"
      className={cn(
        "ring-background bg-brand pointer-events-none absolute top-0.5 right-0.5 size-2 rounded-full ring-2",
        className,
      )}
    />
  )
}

/**
 * The fresh dot for `name` and the function that clears it, for the component
 * that introduces what is fresh:
 *
 * @example
 * const { freshDot, markSeen } = useFresh(FRESH.modeToggle)
 * <DropdownMenu onOpenChange={markSeen}>
 *   <DropdownMenuTrigger render={<Button className="relative">…{freshDot}</Button>} />
 *
 * `markSeen` ignores a `false` first argument, so it can be passed straight to an
 * `onOpenChange` (closing doesn't count) as well as an `onClick`.
 */
export function useFresh(
  name: FreshName,
  { className }: { className?: string } = {},
): { freshDot: React.ReactNode; markSeen: (open?: unknown) => void } {
  const markThisSeen = useCallback(
    (open?: unknown): void => {
      if (open !== false) markSeen(name)
    },
    [name],
  )
  return { freshDot: <Fresh name={name} className={className} />, markSeen: markThisSeen }
}
