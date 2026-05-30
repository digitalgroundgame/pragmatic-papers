import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu"
import { type MenuField } from "@/payload-types"
import { CMSLink } from "../Link/CMSLink2"

interface MegaMenuProps {
  menu?: MenuField
}

export function MegaMenu({ menu }: MegaMenuProps): React.ReactNode {
  if (!menu) return null
  return (
    <div className="mt-2 hidden w-full justify-center md:flex">
      <NavigationMenu
        align="center"
        //   className="hidden w-full max-w-full flex-none justify-center md:flex"
      >
        <NavigationMenuList className="space-x-1">
          {/* <NavigationMenuItem>
      <NavigationMenuTrigger>Item One</NavigationMenuTrigger>
      <NavigationMenuContent>
        <NavigationMenuLink>Link</NavigationMenuLink>
      </NavigationMenuContent>
    </NavigationMenuItem> */}
          {menu.map((item) => (
            <NavigationMenuItem key={item.id}>
              <NavigationMenuLink className="py-1" render={<CMSLink link={item.link} />} />
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  )
}
