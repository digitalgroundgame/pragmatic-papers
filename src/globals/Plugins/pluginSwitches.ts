import type { CheckboxField, Config, Plugin } from "payload"

import { registeredPlugins } from "@/utilities/registerPlugin"

/** The Plugins global's slug, which holds the switches. */
export const PLUGINS_SLUG = "plugins"

/** The group in the Plugins global that holds a checkbox per switch, named for its plugin. */
export const SWITCHES_GROUP = "switches"

/**
 * Adds a switch to System → Plugins for every plugin whose manifest offers one, as a checkbox in
 * the global's `switches` group named for the plugin's slug, which the plugins table shows. It runs after every other plugin
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
          admin: { description: registered.switch.description },
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
                  name: SWITCHES_GROUP,
                  type: "group",
                  // The plugins table shows each switch in its plugin's Status cell, so the
                  // group renders nothing. Its checkboxes stay in the form and save with it.
                  admin: {
                    components: { Field: "@/globals/Plugins/components/NoField#NoField" },
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
