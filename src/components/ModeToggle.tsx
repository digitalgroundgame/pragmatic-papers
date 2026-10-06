"use client"

import { useTheme } from "@wrksz/themes/client"
import { Moon, Sun } from "lucide-react"
import React from "react"

import { FRESH, useFresh } from "@/components/Fresh"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/utilities/utils"

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
  const { freshDot, markSeen } = useFresh(FRESH.modeToggle)

  function handleSetTheme(next: Theme): void {
    setTheme(next)
    onThemeChange?.(next)
  }

  return (
    <DropdownMenu onOpenChange={markSeen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant={showLabel ? "outline" : "ghost"}
            size={showLabel ? "lg" : "icon-sm"}
            className={cn("relative", showLabel && "w-full")}
            data-tour="mode-toggle"
          >
            {/* The moon stacks on the sun inside this box, not over the label. */}
            <span className="relative inline-flex size-5 shrink-0">
              <Sun className="size-5 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
              <Moon className="absolute inset-0 size-5 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
            </span>
            <span className={showLabel ? undefined : "sr-only"}>Toggle theme</span>
            {showFresh && freshDot}
          </Button>
        }
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
