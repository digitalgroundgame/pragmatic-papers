import { MenuLink } from "@/components/Menu/MenuLink"
import {
  navigationMenuClassName,
  navigationMenuLinkClassName,
  navigationMenuListClassName,
} from "@/components/ui/navigation-menu-styles"
import { type MenuField } from "@/payload-types"
import { getLinkFieldUrl, linksToUnpublished } from "@/utilities/getLinkFieldUrl"
import { cn } from "@/utilities/utils"
import { CMSLink } from "../Link"
import type { MegaMenuItem } from "./Interactive"
import { LazyMegaMenu } from "./MegaMenu.lazy"

interface MegaMenuProps {
  menu?: MenuField
  /** Names the `nav` landmark, so a page's navs can be told apart. */
  label: string
}

/**
 * The main menu across the top of wide screens. It renders as plain links in the navigation
 * menu's markup, and becomes base-ui's NavigationMenu (with its dropdowns and keyboard
 * handling) when the reader first points at or focuses it.
 */
export function MegaMenu({ menu, label }: MegaMenuProps): React.ReactNode {
  if (!menu) return null
  const items = menu.flatMap(({ id, link }): MegaMenuItem[] => {
    const href = getLinkFieldUrl(link)
    if (!href || !link || linksToUnpublished(link)) return []
    return [{ id: id ?? href, href, link: <CMSLink link={link} /> }]
  })
  return (
    <div className="my-2 hidden w-full justify-center md:flex" data-tour="mega-menu">
      <LazyMegaMenu items={items} label={label}>
        <nav data-slot="navigation-menu" aria-label={label} className={navigationMenuClassName}>
          <ul
            data-slot="navigation-menu-list"
            className={cn(navigationMenuListClassName, "space-x-1")}
          >
            {items.map(({ id, href, link }) => (
              <li key={id} data-slot="navigation-menu-item" className="relative">
                <MenuLink
                  href={href}
                  data-slot="navigation-menu-link"
                  className={cn(navigationMenuLinkClassName, "py-1")}
                  render={link}
                />
              </li>
            ))}
          </ul>
        </nav>
      </LazyMegaMenu>
    </div>
  )
}
