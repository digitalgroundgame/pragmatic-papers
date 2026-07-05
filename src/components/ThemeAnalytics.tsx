"use client"

import { sendGAEvent } from "@next/third-parties/google"
import { useTheme } from "@wrksz/themes/client"
import React from "react"

export function ThemeAnalytics(): null {
  const { resolvedTheme } = useTheme()

  React.useEffect(() => {
    if (!resolvedTheme) return
    sendGAEvent("event", "theme_preference", { theme: resolvedTheme })
  }, [resolvedTheme])

  return null
}
