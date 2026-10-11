"use client"

import { XIcon } from "lucide-react"
import React from "react"

import { Logo } from "@/components/Logo"
import { ModeToggleAnalytics } from "@/components/ModeToggleAnalytics"
import { Button } from "@/components/ui/button"
import {
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { MenuSheet } from "@/Header/MenuSheet/Component"
import { SearchForm } from "@/Header/SearchForm/Component"

import { MenuButton } from "./MenuButton"

interface MobileMenuProps {
  /** The site's menu, rendered on the server. */
  menu: React.ReactNode
  /** The social links, rendered on the server. */
  socials: React.ReactNode
}

/** The menu button and the sheet it opens from the left: search, the menu and the socials. */
export function MobileMenu({ menu, socials }: MobileMenuProps): React.ReactNode {
  return (
    <MenuSheet>
      <SheetTrigger render={<MenuButton />} />
      <SheetContent
        className="space-y-4 data-[side=left]:w-full data-[side=left]:sm:max-w-sm"
        side="left"
        showCloseButton={false}
      >
        <SheetHeader className="flex flex-row items-center justify-between">
          <SheetTitle className="my-2 md:my-0">
            <Logo size="sm" />
          </SheetTitle>
          <SheetClose
            render={
              <Button variant="ghost" size="icon-lg">
                <XIcon className="size-7" />
                <span className="sr-only">Close</span>
              </Button>
            }
          />
        </SheetHeader>
        <SearchForm />
        {menu}
        <div className="flex items-center gap-2 px-4 py-3">
          {socials}
          <ModeToggleAnalytics location="header-mobile-menu" showFresh />
        </div>
      </SheetContent>
    </MenuSheet>
  )
}
