"use client"

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from "@/components/ui/navigation-menu"
import { MegaMenuLink } from "./MegaMenuLink"

export interface MegaMenuItem {
  id: string
  href: string
  /** The link, rendered on the server; NavigationMenu's link renders as it. */
  link: React.ReactElement
}

interface InteractiveMegaMenuProps {
  items: MegaMenuItem[]
  label: string
}

/** The mega menu as base-ui's NavigationMenu, which `LazyMegaMenu` loads on first use. */
export function InteractiveMegaMenu({ items, label }: InteractiveMegaMenuProps): React.ReactNode {
  return (
    <NavigationMenu aria-label={label} align="center">
      <NavigationMenuList className="space-x-1">
        {items.map(({ id, href, link }) => (
          <NavigationMenuItem key={id}>
            <MegaMenuLink href={href} className="py-1" render={link} />
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  )
}
