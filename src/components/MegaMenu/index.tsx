import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from "@/components/ui/navigation-menu"
import { type MenuField } from "@/payload-types"
import { getLinkFieldUrl } from "@/utilities/getLinkFieldUrl"
import { CMSLink } from "../Link/CMSLink2"
import { MegaMenuLink } from "./MegaMenuLink"

interface MegaMenuProps {
  menu?: MenuField
}

export function MegaMenu({ menu }: MegaMenuProps): React.ReactNode {
  if (!menu) return null
  return (
    <div className="my-2 hidden w-full justify-center md:flex">
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
          {menu.map((item) => {
            const url = getLinkFieldUrl(item.link)
            if (!url) return null
            return (
              <NavigationMenuItem key={item.id}>
                <MegaMenuLink href={url} className="py-1" render={<CMSLink link={item.link} />} />
              </NavigationMenuItem>
            )
          })}
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  )
}
