import { Logo } from "@/components/Logo"
import { PaperIcon } from "@/components/Logo/icons/PaperIcon"
import { MegaMenu } from "@/components/MegaMenu"
import { Menu } from "@/components/Menu"
import { SocialLinks } from "@/components/SocialLinks"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LinkButton } from "@/components/ui/link-button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { HeaderActions } from "@/Header/HeaderActions/Component"
import type { Footer, Header } from "@/payload-types"
import { getCachedGlobal } from "@/utilities/getGlobals"
import { SearchIcon, TextSearch, User, XIcon } from "lucide-react"
import React from "react"

export async function Header(): Promise<React.JSX.Element> {
  const [{ navItems, actions }, { socials }]: [Header, Footer] = await Promise.all([
    getCachedGlobal("header", 1)(),
    getCachedGlobal("footer", 1)(),
  ])

  return (
    <>
      <header className="bg-background sticky top-0 z-50">
        <div className="container">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-b py-3">
            <Sheet>
              <SheetTrigger
                render={
                  <Button variant="ghost" size="icon">
                    <TextSearch className="size-6" />
                    <span className="sr-only">Menu</span>
                  </Button>
                }
              />
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
                <div className="bg-muted mx-4 mb-6 flex items-center gap-2 rounded-sm border px-3 py-2">
                  <Input
                    type="search"
                    placeholder="Search Coming Soon…"
                    disabled
                    aria-label="Search box"
                    className="border-none bg-transparent"
                  />
                  <Button variant="ghost" size="icon" disabled tabIndex={-1}>
                    <SearchIcon className="size-5" />
                    <span className="sr-only">Search</span>
                  </Button>
                </div>
                <Menu menu={navItems} layout="stacked" slot={SheetClose} />
                <SocialLinks socials={socials} className="px-4 py-3" />
              </SheetContent>
            </Sheet>
            <a
              href="/"
              aria-label="Link to Home"
              className="inline-flex items-center justify-center"
            >
              <Logo />
            </a>
            <div className="flex items-center justify-end gap-2">
              <HeaderActions actions={actions} className="hidden lg:flex" />
              <Sheet>
                <SheetTrigger
                  render={
                    <Button variant="ghost" size="icon" className="lg:hidden">
                      <User className="size-6" />
                      <span className="sr-only">Account</span>
                    </Button>
                  }
                />
                <SheetContent
                  className="items-center justify-center space-y-4 py-4 data-[side=right]:w-full sm:w-3/4 data-[side=right]:sm:max-w-sm [&>button:last-child]:top-3 [&>button:last-child_svg]:size-7"
                  side="right"
                >
                  <SheetHeader>
                    <div className="bg-brand flex aspect-square items-center justify-center rounded-sm p-2">
                      <PaperIcon className="text-white" />
                    </div>
                    <SheetTitle className="text-3xl">Account</SheetTitle>
                  </SheetHeader>
                  <div className="w-full space-y-2 px-4">
                    <HeaderActions
                      actions={actions}
                      className="w-full justify-center [&>a]:w-1/2"
                    />
                    <LinkButton variant="outline" size="lg" className="w-full" href="/admin/login">
                      Log In
                    </LinkButton>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>
      <MegaMenu menu={navItems} />
    </>
  )
}
