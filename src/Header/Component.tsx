import { LazyModeToggle } from "@/components/ModeToggleAnalytics.lazy"
import { MegaMenu } from "@/components/MegaMenu"
import { Menu } from "@/components/Menu"
import { SocialLinks } from "@/components/SocialLinks"
import { LinkButton } from "@/components/ui/link-button"
import { isExperimentEnabled } from "@/globals/SiteSettings/isExperimentEnabled"
import { HeaderLogo } from "@/Header/chrome"
import { HeaderActions } from "@/Header/HeaderActions/Component"
import { LazyMobileMenu } from "@/Header/MobileMenu/Component.lazy"
import { LazySettingsSheet } from "@/Header/SettingsSheet/Component.lazy"
import type { Footer, Header } from "@/payload-types"
import { getCachedGlobal } from "@/utilities/getGlobals"
import { Newspaper } from "lucide-react"
import React from "react"

// The menus, sheets and mode toggles here render as their buttons and links, and load their
// interactive parts when the reader first reaches for them (`LoadOnInteraction`), so none of
// base-ui's dialogs and menus is in the JavaScript a page loads first.
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
              <LazyMobileMenu
                menu={<Menu menu={navItems} label="Main" layout="stacked" />}
                socials={<SocialLinks socials={socials} />}
              />
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
                <LazyModeToggle location="header" showFresh />
              </div>
              <HeaderActions actions={actions} className="hidden lg:flex" />
              <LazySettingsSheet
                actions={
                  <HeaderActions actions={actions} className="w-full justify-center [&>a]:w-1/2" />
                }
              />
            </div>
          </div>
        </div>
      </header>
      <MegaMenu menu={navItems} label="Main" />
    </>
  )
}
