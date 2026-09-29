"use client"

import React from "react"

import { NotificationDot } from "@/components/NotificationDot"
import { useNotification } from "@/providers/NotificationProvider"

/**
 * The theme toggle's dot, shown on the account button at widths where the
 * toggle is folded into the account sheet. Opening the toggle clears it.
 */
export function ThemeSelectorDot(): React.ReactNode {
  const { visible } = useNotification("theme-selector")
  return <NotificationDot visible={visible} />
}
