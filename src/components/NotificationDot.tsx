"use client"

import React from "react"

import { useNotification } from "@/providers/NotificationProvider"
import { cn } from "@/utilities/utils"

interface NotificationDotProps {
  /** The notification this dot belongs to. It shows until something calls that notification's `markSeen`. */
  name: string
  className?: string
}

/**
 * A small dot in the top-right corner of the nearest `relative` ancestor, shown
 * until the reader has seen `name`. Clearing it is up to the feature it points
 * at: call `useNotification(name).markSeen` where the reader interacts with it.
 */
export function NotificationDot({ name, className }: NotificationDotProps): React.ReactNode {
  const { visible } = useNotification(name)
  if (!visible) return null
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
