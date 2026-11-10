import { CMSLink } from "@/components/Link"
import type { MenuField } from "@/payload-types"
import { linkHref, linksToUnpublished } from "@/utilities/linkField"
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
 * A navigation menu built from a menu field's items, in a `nav` landmark named
 * by `label`. `layout` lays the links out in a row (`inline`), a column
 * (`stacked`), or a column that becomes a row on wider screens (`responsive`).
 */
export const Menu: React.FC<MenuProps> = ({ menu, label, className, layout, ...props }) => {
  if (!menu) return null

  return (
    <nav aria-label={label}>
      <ul className={cn(menuVariants({ className, layout }))} {...props}>
        {menu.map(({ link, id }, index) => {
          const url = linkHref(link)
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
