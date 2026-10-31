import { adminFieldLevel } from "@/access/fields"
import { isEditor } from "@/access/roles"
import { menu } from "@/fields/menu"
import { revalidateHeader } from "@/Header/hooks/revalidateHeader"
import { tickerField } from "@/Header/Ticker/field"
import type { GlobalConfig } from "payload"

export const Header: GlobalConfig = {
  slug: "header",
  admin: {
    group: "Site",
  },
  access: {
    read: () => true,
    // Editors save the ticker's hidden posts; everything else here is admin-only per field.
    update: ({ req: { user } }) => isEditor(user),
  },
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          label: "Navigation",
          fields: [
            menu({
              name: "navItems",
              label: "Navigation Items",
              maxRows: 12,
              labels: { singular: "Menu Item", plural: "Menu Items" },
              access: { update: adminFieldLevel },
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
              access: { update: adminFieldLevel },
            }),
          ],
        },
        { label: "Ticker", fields: [tickerField] },
      ],
    },
  ],
  hooks: {
    afterChange: [revalidateHeader],
  },
}
