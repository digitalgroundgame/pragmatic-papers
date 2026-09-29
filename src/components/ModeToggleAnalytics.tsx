"use client"

import { sendGAEvent } from "@next/third-parties/google"
import React from "react"

import { ModeToggle, type Theme } from "@/components/ModeToggle"

interface ModeToggleAnalyticsProps {
  /** Render a full-width labeled button instead of the compact icon-only toggle. */
  showLabel?: boolean
  /** Identifies where this toggle is rendered, reported alongside theme_change analytics. */
  location?: string
  /** Show the mode toggle's notification dot on this toggle. */
  notificationDot?: boolean
}

export function ModeToggleAnalytics({
  showLabel,
  location,
  notificationDot,
}: ModeToggleAnalyticsProps): React.JSX.Element {
  function handleThemeChange(theme: Theme): void {
    sendGAEvent("event", "theme_change", { theme, location })
  }

  return (
    <ModeToggle
      showLabel={showLabel}
      onThemeChange={handleThemeChange}
      notificationDot={notificationDot}
    />
  )
}
