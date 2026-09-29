"use client"

import React, { useCallback } from "react"

import { cn } from "@/utilities/utils"

import type { DotName } from "./names"
import { markSeen, useIsUnseen } from "./store"

export { DOTS, type DotName } from "./names"

interface DotProps {
  /** Which dot this is. It shows until something calls `markSeen` for the same name. */
  name: DotName
  className?: string
}

/**
 * A small dot marking a feature the reader hasn't tried yet (not a carousel's
 * position dots), in the top-right corner of the nearest `relative` ancestor,
 * shown until the reader has seen `name`. Clearing it is up to the feature it points
 * at: call `useDot(name).markSeen` where the reader interacts with it.
 * Renders nothing on the server, so it never causes a hydration mismatch.
 */
export function Dot({ name, className }: DotProps): React.ReactNode {
  if (!useIsUnseen(name)) return null
  return (
    <span
      aria-hidden="true"
      data-slot="dot"
      className={cn(
        "ring-background bg-brand pointer-events-none absolute top-0.5 right-0.5 size-2 rounded-full ring-2",
        className,
      )}
    />
  )
}

/**
 * The dot called `name` and the function that clears it, for a component that
 * introduces a feature:
 *
 * @example
 * const { dot, markSeen } = useDot(DOTS.modeToggle)
 * <DropdownMenu onOpenChange={markSeen}>
 *   <DropdownMenuTrigger render={<Button className="relative">…{dot}</Button>} />
 *
 * `markSeen` ignores a `false` first argument, so it can be passed straight to an
 * `onOpenChange` (closing doesn't count) as well as an `onClick`.
 */
export function useDot(
  name: DotName,
  { className }: { className?: string } = {},
): { dot: React.ReactNode; markSeen: (open?: unknown) => void } {
  const markThisSeen = useCallback(
    (open?: unknown): void => {
      if (open !== false) markSeen(name)
    },
    [name],
  )
  return { dot: <Dot name={name} className={className} />, markSeen: markThisSeen }
}
