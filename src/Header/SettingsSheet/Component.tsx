"use client"

import React from "react"

import { PaperIcon } from "@/components/Logo/icons/PaperIcon"
import { ModeToggleAnalytics } from "@/components/ModeToggleAnalytics"
import { LinkButton } from "@/components/ui/link-button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

import { SettingsButton } from "./SettingsButton"

interface SettingsSheetProps {
  /** The header's action buttons, rendered on the server. */
  actions: React.ReactNode
}

/** Below lg, the button and the sheet it opens from the right: actions, log in and the theme. */
export function SettingsSheet({ actions }: SettingsSheetProps): React.ReactNode {
  return (
    <Sheet>
      <SheetTrigger render={<SettingsButton />} />
      <SheetContent
        className="items-center justify-center space-y-4 py-4 data-[side=right]:w-full sm:w-3/4 data-[side=right]:sm:max-w-sm [&>button:last-child]:top-3 [&>button:last-child_svg]:size-7"
        side="right"
      >
        <SheetHeader>
          <div className="bg-brand flex aspect-square items-center justify-center rounded-sm p-2">
            <PaperIcon className="text-white" />
          </div>
          <SheetTitle className="text-3xl">Settings</SheetTitle>
        </SheetHeader>
        <div className="flex w-full flex-col gap-2 px-4">
          {actions}
          <LinkButton variant="outline" size="lg" className="w-full" href="/admin/login">
            Log In
          </LinkButton>
          <ModeToggleAnalytics showLabel location="header-mobile-sheet" showFresh />
        </div>
      </SheetContent>
    </Sheet>
  )
}
