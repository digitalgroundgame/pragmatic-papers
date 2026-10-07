import { CMSLink } from "@/components/Link/CMSLink2"
import type { MenuField } from "@/payload-types"
import { getLinkFieldUrl, linksToUnpublished } from "@/utilities/getLinkFieldUrl"
import { cn } from "@/utilities/utils"
import { type VariantProps, cva } from "class-variance-authority"
import React from "react"
import { MenuLink } from "./MenuLink"

const menuVariants = cva("flex", {
  defaultVariants: {
    layout: "responsive",
  },
  variants: {
    layout: {
      inline: "flex-row gap-2 items-center",
      stacked: "flex-col items-start",
      responsive: "flex-col gap-1 items-start md:flex-row md:gap-2 md:items-center",
    },
  },
})

const menuItemVariants = cva("text-foreground", {
  defaultVariants: {
    layout: "responsive",
  },
  variants: {
    layout: {
      inline: "hover:underline text-sm underline-offset-4",
      stacked: "w-full justify-start border-0 border-t hover:bg-muted",
      responsive: "hover:underline text-sm underline-offset-4",
    },
  },
})

interface MenuProps
  extends React.HTMLAttributes<HTMLUListElement>, VariantProps<typeof menuVariants> {
  menu?: MenuField
  /** Names the `nav` landmark, so a page's navs can be told apart ("Main", "Footer"). */
  label: string
}

/**
 * Menu component renders a navigation menu based on menu data.
 *
 * @param menu - The array of menu items to display.
 * @param label - Accessible name for the `nav` landmark.
 * @param className - Additional classes for the menu container.
 * @param layout - Specifies the menu layout variant ('inline', 'stacked', or 'responsive').
 * @param props - All other HTML div props.
 *
 * @example
 * <Menu menu={menuData} label="Footer" layout="inline" />
 * <Menu menu={menuData} label="Main" layout="stacked" />
 */
export const Menu: React.FC<MenuProps> = ({ menu, label, className, layout, ...props }) => {
  if (!menu) return null

  return (
    <nav aria-label={label}>
      <ul className={cn(menuVariants({ className, layout }))} {...props}>
        {menu.map(({ link, id }, index) => {
          const url = getLinkFieldUrl(link)
          if (!url || linksToUnpublished(link)) return null
          const isStacked = layout === "stacked"
          return (
            <li key={id || `menu-item-${index}`} className={menuItemVariants({ layout })}>
              <MenuLink
                href={url}
                render={
                  <CMSLink
                    link={link}
                    className={cn(
                      "block w-full text-left",
                      isStacked && "data-active:bg-muted px-4 py-3 data-active:font-semibold",
                    )}
                  />
                }
              />
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
