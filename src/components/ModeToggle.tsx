"use client"

import { useTheme } from "@wrksz/themes/client"
import { Moon, Sun } from "lucide-react"
import React from "react"

import { NotificationDot } from "@/components/NotificationDot"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useNotification } from "@/providers/NotificationProvider"

export function ModeToggle(): React.JSX.Element {
  const { setTheme } = useTheme()
  const { visible, markSeen } = useNotification("theme-selector")

  return (
    <DropdownMenu onOpenChange={(open) => open && markSeen()}>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="relative" data-tour="mode-toggle">
            <Sun className="size-5 scale-100 rotate-0 transition-all dark:scale-0 dark:rotate-90" />
            <Moon className="absolute size-5 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
            <span className="sr-only">Toggle theme</span>
            <NotificationDot visible={visible} />
          </Button>
        }
      />
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
