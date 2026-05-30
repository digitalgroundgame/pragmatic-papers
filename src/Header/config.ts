import { adminFieldLevel } from "@/access/admins"
import { menu } from "@/fields/menu"
import { revalidateHeader } from "@/Header/hooks/revalidateHeader"
import type { GlobalConfig } from "payload"

export const Header: GlobalConfig = {
  slug: "header",
  access: {
    read: () => true,
    update: adminFieldLevel,
  },
  fields: [
    menu({
      name: "navItems",
      label: "Navigation Items",
      maxRows: 12,
      labels: { singular: "Menu Item", plural: "Menu Items" },
    }),
    menu({
      name: "actions",
      label: "Action Buttons",
      maxRows: 4,
      labels: { singular: "Action", plural: "Actions" },
      admin: {
        description:
          'Buttons shown in the header top-right. Use "Branded" variant for most important button.',
      },
    }),
  ],
  hooks: {
    afterChange: [revalidateHeader],
  },
}
