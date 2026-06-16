"use client"

import React from "react"

import { NotificationDot } from "@/components/NotificationDot"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu"
import { CMSLink } from "../Link/CMSLink2"
import { type MenuField } from "@/payload-types"
import { useNotification } from "@/providers/NotificationProvider"

interface MegaMenuProps {
  menu?: MenuField
}

function MegaMenuItem({ item }: { item: NonNullable<MenuField>[number] }): React.ReactNode {
  const { visible, markSeen } = useNotification(`nav:${item.id}`)
  return (
    <NavigationMenuItem>
      <NavigationMenuLink
        className="py-1"
        render={<CMSLink link={item.link} onClick={markSeen} />}
      />
      <NotificationDot visible={visible} className="-top-1 -right-1" />
    </NavigationMenuItem>
  )
}

export function MegaMenu({ menu }: MegaMenuProps): React.ReactNode {
  if (!menu) return null
  return (
    <div className="my-2 hidden w-full justify-center md:flex" data-tour="mega-menu">
      <NavigationMenu align="center">
        <NavigationMenuList className="space-x-1">
          {menu.map((item) => (
            <MegaMenuItem key={item.id} item={item} />
          ))}
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  )
}
