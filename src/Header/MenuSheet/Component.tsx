"use client"

import React, { useState } from "react"

import { Sheet } from "@/components/ui/sheet"

/**
 * The mobile menu's sheet, closed by any link inside it. A link that opens a
 * new tab would otherwise leave the sheet covering the page it came from.
 * React clicks bubble through the portal, so one handler covers the content.
 */
export function MenuSheet({ children }: { children: React.ReactNode }): React.ReactNode {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div
        className="contents"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a[href]")) setOpen(false)
        }}
      >
        {children}
      </div>
    </Sheet>
  )
}
