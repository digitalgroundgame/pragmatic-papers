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
          <Button
            variant={showLabel ? "outline" : "ghost"}
            size={showLabel ? "lg" : "icon-sm"}
            className={showLabel ? "w-full" : undefined}
          >
            <span className="relative inline-flex size-5 items-center justify-center">
              <Sun className="size-5 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
              <Moon className="absolute size-5 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
            </span>
            <span className={showLabel ? undefined : "sr-only"}>Toggle theme</span>
          </Button>
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
