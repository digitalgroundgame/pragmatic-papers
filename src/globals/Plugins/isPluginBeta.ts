import { getPayloadClient } from "@/data/payload"
import { isBeta, registeredPlugins } from "@/utilities/registerPlugin"

import type { PluginSwitchName } from "./isPluginEnabled"

/**
 * Whether a plugin is still a beta (its switch starts off), as System → Plugins badges it. A
 * page shows `BetaBadge` on what the plugin adds while this holds, so the badge goes away on its
 * own when the plugin graduates.
 */
export const isPluginBeta = async (name: PluginSwitchName): Promise<boolean> => {
  const payload = await getPayloadClient()
  const plugin = registeredPlugins(payload.config).find(({ slug }) => slug === name)
  return plugin ? isBeta(plugin) : false
}
