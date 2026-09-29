import { Logo } from "@/components/Logo"
import { PaperIcon } from "@/components/Logo/icons/PaperIcon"
import { MegaMenu } from "@/components/MegaMenu"
import { Menu } from "@/components/Menu"
import { ModeToggleAnalytics } from "@/components/ModeToggleAnalytics"
import { Dot } from "@/components/Dot"
import { DOTS } from "@/components/Dot/names"
import { SocialLinks } from "@/components/SocialLinks"
import { Button } from "@/components/ui/button"
import { LinkButton } from "@/components/ui/link-button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { isExperimentEnabled } from "@/globals/SiteSettings/isExperimentEnabled"
import { HeaderLogo } from "@/Header/chrome"
import { HeaderActions } from "@/Header/HeaderActions/Component"
import { MenuSheet } from "@/Header/MenuSheet/Component"
import { SearchForm } from "@/Header/SearchForm/Component"
import type { Footer, Header } from "@/payload-types"
import { getCachedGlobal } from "@/utilities/getGlobals"
import { Newspaper, TextSearch, User, XIcon } from "lucide-react"
import React from "react"

export async function Header(): Promise<React.JSX.Element> {
  const [{ navItems, actions }, { socials }, feedEnabled]: [Header, Footer, boolean] =
    await Promise.all([
      getCachedGlobal("header", 1)(),
      getCachedGlobal("footer", 2)(),
      isExperimentEnabled("feed"),
    ])

  return (
    <>
      <header className="bg-background sticky top-0 z-50">
        <div className="container">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-b py-3">
            <div className="flex items-center gap-1">
              <MenuSheet>
                <SheetTrigger
                  render={
                    <Button variant="ghost" size="icon" data-tour="search">
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
                  <SearchForm />
                  <Menu menu={navItems} layout="stacked" />
                  <div className="flex items-center gap-2 px-4 py-3">
                    <SocialLinks socials={socials} />
                    <ModeToggleAnalytics location="header-mobile-menu" showDot />
                  </div>
                </SheetContent>
              </MenuSheet>
              {feedEnabled && (
                <LinkButton href="/feed" variant="ghost" size="icon" aria-label="Feed">
                  <Newspaper className="size-6" />
                  <span className="sr-only">Feed</span>
                </LinkButton>
              )}
            </div>
            <a
              href="/"
              aria-label="Link to Home"
              className="inline-flex items-center justify-center"
            >
              <HeaderLogo />
            </a>
            <div className="flex items-center justify-end gap-2">
              <div className="hidden lg:flex">
                <ModeToggleAnalytics location="header" showDot />
              </div>
              <HeaderActions actions={actions} className="hidden lg:flex" />
              <Sheet>
                <SheetTrigger
                  render={
                    <Button variant="ghost" size="icon" className="relative lg:hidden">
                      <User className="size-6" />
                      <span className="sr-only">User and Settings</span>
                      {/* Below lg the mode toggle lives in this sheet; opening it clears the dot. */}
                      <Dot name={DOTS.modeToggle} />
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
                    <SheetTitle className="text-3xl">Settings</SheetTitle>
                  </SheetHeader>
                  <div className="flex w-full flex-col gap-2 px-4">
                    <HeaderActions
                      actions={actions}
                      className="w-full justify-center [&>a]:w-1/2"
                    />
                    <LinkButton variant="outline" size="lg" className="w-full" href="/admin/login">
                      Log In
                    </LinkButton>
                    <ModeToggleAnalytics showLabel location="header-mobile-sheet" showDot />
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
