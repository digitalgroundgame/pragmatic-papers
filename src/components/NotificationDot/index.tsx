"use client"

import React, { useCallback } from "react"

import { cn } from "@/utilities/utils"

import type { NotificationDotName } from "./names"
import { markSeen, useIsUnseen } from "./store"

export { NOTIFICATION_DOTS, type NotificationDotName } from "./names"

interface NotificationDotProps {
  /** Which dot this is. It shows until something calls `markSeen` for the same name. */
  name: NotificationDotName
  className?: string
}

/**
 * A small dot in the top-right corner of the nearest `relative` ancestor, shown
 * until the reader has seen `name`. Clearing it is up to the feature it points
 * at: call `useNotificationDot(name).markSeen` where the reader interacts with it.
 * Renders nothing on the server, so it never causes a hydration mismatch.
 */
export function NotificationDot({ name, className }: NotificationDotProps): React.ReactNode {
  if (!useIsUnseen(name)) return null
  return (
    <span
      aria-hidden="true"
      data-slot="notification-dot"
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
 * const { dot, markSeen } = useNotificationDot(NOTIFICATION_DOTS.modeToggle)
 * <DropdownMenu onOpenChange={markSeen}>
 *   <DropdownMenuTrigger render={<Button className="relative">…{dot}</Button>} />
 *
 * `markSeen` ignores a `false` first argument, so it can be passed straight to an
 * `onOpenChange` (closing doesn't count) as well as an `onClick`.
 */
export function useNotificationDot(
  name: NotificationDotName,
  { className }: { className?: string } = {},
): { dot: React.ReactNode; markSeen: (open?: unknown) => void } {
  const markThisSeen = useCallback(
    (open?: unknown): void => {
      if (open !== false) markSeen(name)
    },
    [name],
  )
  return { dot: <NotificationDot name={name} className={className} />, markSeen: markThisSeen }
}
