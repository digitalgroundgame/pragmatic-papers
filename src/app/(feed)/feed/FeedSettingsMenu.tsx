"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Home, MoreVertical } from "lucide-react"
import Link from "next/link"
import React from "react"

export function FeedSettingsMenu(): React.ReactNode {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Open feed menu"
            className="h-8 w-8 rounded-full text-white hover:bg-white/10 hover:text-white"
          >
            <MoreVertical className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={6}>
        <DropdownMenuItem render={<Link href="/" />}>
          <Home className="size-4" />
          <span>Home</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
