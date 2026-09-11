import { cn } from "@/utilities/utils"
import React from "react"

interface NotificationDotProps {
  visible: boolean
  className?: string
}

export function NotificationDot({ visible, className }: NotificationDotProps): React.ReactNode {
  if (!visible) return null
  return (
    <span
      aria-hidden="true"
      className={cn(
        "ring-background bg-brand pointer-events-none absolute top-0.5 right-0.5 size-2 rounded-full ring-2",
        className,
      )}
    />
  )
}
