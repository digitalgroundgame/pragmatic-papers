"use client"

import { useTheme } from "@wrksz/themes/client"
import React from "react"

import { FRESH, useFresh } from "@/components/Fresh"
import { ModeToggleButton } from "@/components/ModeToggleButton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type Theme = "light" | "dark" | "system"

interface ModeToggleProps {
  /** Render a full-width labeled button instead of the compact icon-only toggle. */
  showLabel?: boolean
  /** Called after the theme is set, with the theme the user selected. */
  onThemeChange?: (theme: Theme) => void
  /** Show the fresh dot on this toggle. Opening any mode toggle clears it everywhere. */
  showFresh?: boolean
}

export function ModeToggle({
  showLabel = false,
  onThemeChange,
  showFresh = false,
}: ModeToggleProps): React.JSX.Element {
  const { setTheme, theme } = useTheme()
  const { markSeen } = useFresh(FRESH.modeToggle)

  function handleSetTheme(next: Theme): void {
    setTheme(next)
    onThemeChange?.(next)
  }

  return (
    <DropdownMenu onOpenChange={markSeen}>
      <DropdownMenuTrigger
        render={<ModeToggleButton showLabel={showLabel} showFresh={showFresh} />}
      />
      <DropdownMenuContent align={showLabel ? "center" : "start"}>
        <DropdownMenuItem disabled={theme === "light"} onClick={() => handleSetTheme("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem disabled={theme === "dark"} onClick={() => handleSetTheme("dark")}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem disabled={theme === "system"} onClick={() => handleSetTheme("system")}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
