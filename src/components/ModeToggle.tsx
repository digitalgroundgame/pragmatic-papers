"use client"

import { sendGAEvent } from "@next/third-parties/google"
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

interface ModeToggleProps {
  /** Render a full-width labeled button instead of the compact icon-only toggle. */
  showLabel?: boolean
  /** Identifies where this toggle is rendered, reported alongside theme_change analytics. */
  location?: string
}

export function ModeToggle({
  showLabel = false,
  location,
}: ModeToggleProps = {}): React.JSX.Element {
  const { setTheme } = useTheme()

  function handleSetTheme(theme: "light" | "dark" | "system"): void {
    setTheme(theme)
    sendGAEvent("event", "theme_change", { theme, location })
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
        <DropdownMenuItem onClick={() => handleSetTheme("light")}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSetTheme("dark")}>Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSetTheme("system")}>System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
