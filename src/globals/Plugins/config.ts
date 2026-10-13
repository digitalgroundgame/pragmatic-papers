import type { GlobalConfig } from "payload"

import { isAdmin } from "@/access/roles"

import { revalidatePlugins } from "./hooks/revalidatePlugins"
import { PLUGINS_SLUG } from "./pluginSwitches"

/**
 * System → Plugins: every Payload plugin the config installs, ours in `src/plugins/` and the
 * packages alike, whether each is on here, and links to the admin pages that configure it.
 * Below the list, the switches of the plugins that offer one (`pluginSwitches` adds them).
 * Admins only.
 */
export const Plugins: GlobalConfig = {
  slug: PLUGINS_SLUG,
  label: "Plugins",
  access: {
    read: ({ req: { user } }) => isAdmin(user),
    update: ({ req: { user } }) => isAdmin(user),
  },
  admin: {
    group: "System",
    hidden: ({ user }) => !isAdmin(user),
    hideAPIURL: true,
  },
  hooks: { afterChange: [revalidatePlugins] },
  fields: [
    {
      name: "installed",
      type: "ui",
      admin: {
        components: { Field: "@/globals/Plugins/components/PluginsField#PluginsField" },
      },
    },
  ],
}
