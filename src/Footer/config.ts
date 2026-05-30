import type { GlobalConfig } from "payload"

import { adminFieldLevel } from "@/access/admins"
import { link } from "@/fields/link2"
import { menu } from "@/fields/menu"
import { revalidateFooter } from "./hooks/revalidateFooter"

export const Footer: GlobalConfig = {
  slug: "footer",
  access: {
    read: () => true,
    update: adminFieldLevel,
  },
  fields: [
    menu({
      name: "navItems",
      label: "Navigation Items",
      maxRows: 6,
      labels: { singular: "Menu Item", plural: "Menu Items" },
    }),
    menu({
      name: "socials",
      label: "Social Links",
      maxRows: 10,
      labels: { singular: "Social Link", plural: "Social Links" },
    }),
    link({
      label: "Copyright",
      name: "copyright",
      admin: {
        description:
          "The copyright symbol (©) and current year are automatically prepended to the label.",
      },
    }),
  ],
  hooks: {
    afterChange: [revalidateFooter],
  },
}
