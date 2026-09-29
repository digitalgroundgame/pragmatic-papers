"use client"

import React from "react"
import { TextSearch } from "lucide-react"

import { NotificationDot } from "@/components/NotificationDot"
import { Button } from "@/components/ui/button"
import { SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { MenuSheet } from "@/Header/MenuSheet/Component"
import { useNotification } from "@/providers/NotificationProvider"

/** The mobile menu and search sheet, whose trigger carries the `search` dot until first opened. */
export function SearchPanel({ children }: { children: React.ReactNode }): React.ReactNode {
  const { visible, markSeen } = useNotification("search")

  return (
    <MenuSheet>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            data-tour="search"
            onClick={markSeen}
          >
            <TextSearch className="size-6" />
            <span className="sr-only">Menu</span>
            <NotificationDot visible={visible} />
          </Button>
        }
      />
      <SheetContent
        className="space-y-4 data-[side=left]:w-full data-[side=left]:sm:max-w-sm"
        side="left"
        showCloseButton={false}
      >
        {children}
      </SheetContent>
    </MenuSheet>
  )
}
