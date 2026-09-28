"use client"

import { NavigationMenuLink } from "@/components/ui/navigation-menu"
import { isActivePath } from "@/utilities/isActivePath"
import { usePathname } from "next/navigation"

type MegaMenuLinkProps = React.ComponentProps<typeof NavigationMenuLink> & { href: string }

export function MegaMenuLink({ href, ...props }: MegaMenuLinkProps): React.ReactNode {
  const pathname = usePathname()
  return <NavigationMenuLink active={isActivePath(pathname, href)} {...props} />
}
