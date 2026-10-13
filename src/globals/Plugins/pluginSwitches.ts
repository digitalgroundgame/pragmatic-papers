import type { CheckboxField, Config, Plugin } from "payload"

import { registeredPlugins } from "@/utilities/registerPlugin"

/** The Plugins global's slug, which holds the switches. */
export const PLUGINS_SLUG = "plugins"

/**
 * Adds a switch to System → Plugins for every plugin whose manifest offers one, as a checkbox in
 * the global's `switches` group named for the plugin's slug. It runs after every other plugin
 * (`order`), once they've all registered, so no plugin is named here.
 */
export const pluginSwitches = (): Plugin => {
  const plugin: Plugin = (config: Config) => {
    const fields = registeredPlugins(config).flatMap((registered): CheckboxField[] => {
      if (!registered.switch) return []
      if (!/^[a-z][a-zA-Z0-9]*$/.test(registered.slug)) {
        throw new Error(`Plugin "${registered.slug}" needs a camelCase slug to have a switch.`)
      }
      return [
        {
          name: registered.slug,
          type: "checkbox",
          label: registered.switch.label,
          defaultValue: registered.switch.defaultValue,
          admin: {
            description: registered.switch.description,
            components: {
              Field:
                "@/globals/SiteSettings/components/ExperimentSwitchField#ExperimentSwitchField",
            },
          },
        },
      ]
    })
    if (fields.length === 0) return config
    return {
      ...config,
      globals: (config.globals ?? []).map((global) =>
        global.slug === PLUGINS_SLUG
          ? {
              ...global,
              fields: [
                ...global.fields,
                {
                  name: "switches",
                  type: "group",
                  admin: {
                    description:
                      "Switch a plugin off here and it stops at once, without a deploy. Its data stays.",
                  },
                  fields,
                },
              ],
            }
          : global,
      ),
    }
  }
  plugin.order = 1000
  return plugin
}
