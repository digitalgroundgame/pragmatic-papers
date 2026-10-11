import type { GlobalConfig } from "payload"

import { isAdmin } from "@/access/roles"

/**
 * System → Plugins: every Payload plugin the config installs, ours in `src/plugins/` and the
 * packages alike, whether each is on here, and links to the admin pages that configure it. It
 * stores nothing; the page replaces the edit view. Admins only.
 */
export const Plugins: GlobalConfig = {
  slug: "plugins",
  label: "Plugins",
  access: {
    read: ({ req: { user } }) => isAdmin(user),
    update: () => false,
  },
  admin: {
    group: "System",
    hidden: ({ user }) => !isAdmin(user),
    hideAPIURL: true,
    components: {
      views: {
        edit: {
          root: { Component: "@/globals/Plugins/components/PluginsView#PluginsView" },
        },
      },
    },
  },
  fields: [],
}
