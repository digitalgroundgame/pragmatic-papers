import type { Plugin as PluginsGlobal } from "@/payload-types"
import { getGlobal } from "@/data/globals"

export type PluginSwitchName = keyof NonNullable<PluginsGlobal["switches"]>

/**
 * Whether a plugin's switch on System → Plugins is on in this environment. Pass it to the
 * plugin as its `enabled` option, and gate the plugin's routes, links and sitemaps outside
 * `src/plugins/` with it, as for an experiment.
 */
export const isPluginEnabled = async (name: PluginSwitchName): Promise<boolean> => {
  const plugins = await getGlobal("plugins")
  return plugins.switches?.[name] === true
}
