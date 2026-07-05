"use client"

import { useTheme } from "@wrksz/themes/client"
import { Moon, Sun } from "lucide-react"
import React from "react"

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
}

export function ModeToggle({
  showLabel = false,
  onThemeChange,
}: ModeToggleProps = {}): React.JSX.Element {
  const { setTheme, theme } = useTheme()

  function handleSetTheme(next: Theme): void {
    setTheme(next)
    onThemeChange?.(next)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant={showLabel ? "outline" : "ghost"}
            size={showLabel ? "lg" : "icon-sm"}
            className={cn("relative", showLabel && "w-full")}
          >
            <Sun className="size-5 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
            <Moon className="absolute size-5 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
            <span className={showLabel ? undefined : "sr-only"}>Toggle theme</span>
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
