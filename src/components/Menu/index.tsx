import { CMSLink } from "@/components/Link/CMSLink2"
import type { MenuField } from "@/payload-types"
import { cn } from "@/utilities/utils"
import { type VariantProps, cva } from "class-variance-authority"
import React from "react"

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

const menuItemVariants = cva("text-primary", {
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
  extends Omit<React.HTMLAttributes<HTMLUListElement>, "slot">, VariantProps<typeof menuVariants> {
  /** Wraps each menu link. Falls back to a Fragment when undefined. */
  slot?: React.ElementType
  menu?: MenuField
}

/**
 * Menu component renders a navigation menu based on menu data.
 *
 * @param menu - The array of menu items to display.
 * @param className - Additional classes for the menu container.
 * @param layout - Specifies the menu layout variant ('inline', 'stacked', or 'responsive').
 * @param slot - Optional wrapper component for each link (e.g. SheetClose). Falls back to a Fragment.
 * @param props - All other HTML div props.
 *
 * @example
 * <Menu menu={menuData} layout="inline" />
 * <Menu menu={menuData} layout="stacked" slot={SheetClose} />
 */
export const Menu: React.FC<MenuProps> = ({ menu, className, layout, slot, ...props }) => {
  if (!menu) return null

  const Slot = slot ?? React.Fragment

  return (
    <nav>
      <ul className={cn(menuVariants({ className, layout }))} {...props}>
        {menu.map(({ link, id }, index) => {
          const isStacked = layout === "stacked"
          return (
            <li
              key={id || `menu-item-${index}`}
              className={cn(menuItemVariants({ layout }), slot && "[&>button]:w-full")}
            >
              <Slot>
                <CMSLink
                  link={link}
                  className={cn(
                    "block w-full text-left",
                    isStacked &&
                      "data-[active=true]:bg-muted px-4 py-3 data-[active=true]:font-semibold",
                  )}
                />
              </Slot>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
