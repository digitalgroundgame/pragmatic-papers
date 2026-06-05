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

const ThemeIcons = (): React.JSX.Element => (
  <span className="relative inline-flex size-5 items-center justify-center">
    <Sun className="size-5 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
    <Moon className="absolute size-5 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
  </span>
)

interface ModeToggleProps {
  /** Render a full-width labeled button instead of the compact icon-only toggle. */
  showLabel?: boolean
}

export function ModeToggle({ showLabel = false }: ModeToggleProps = {}): React.JSX.Element {
  const { setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          showLabel ? (
            <Button variant="outline" size="lg" className="w-full">
              <ThemeIcons />
              Theme
            </Button>
          ) : (
            <Button variant="ghost" size="icon-sm">
              <ThemeIcons />
              <span className="sr-only">Toggle theme</span>
            </Button>
          )
        }
      />
      <DropdownMenuContent align={showLabel ? "center" : "start"}>
        <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
