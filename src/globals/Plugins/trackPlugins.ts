import type { Config, Plugin } from "payload"

/** A page in the admin, as a path under the admin route (`/globals/site-settings`). */
export interface PluginLink {
  label: string
  path: string
}

/** What System → Plugins says about a plugin. */
export interface PluginInfo {
  name: string
  /** The package it comes from, or the folder of one of ours. */
  source: string
  description: string
  /** Whether it's on in this environment. Leave it out for a plugin that's always on. */
  enabled?: boolean | (() => Promise<boolean>)
  /**
   * Still behind an experiment in Settings. When it graduates, the experiment's checkbox is
   * deleted and so is this, and the plugin reads as stable.
   */
  beta?: boolean
  /** Where it's configured or switched on in the admin, beyond the collections it adds. */
  settings?: PluginLink[]
}

/** A plugin as the config records it: its info and the collections and globals it added. */
export interface InstalledPlugin extends PluginInfo {
  collections: string[]
  globals: string[]
}

const KEY = "installedPlugins"

const slugs = (entries: { slug: string }[] | undefined): string[] =>
  (entries ?? []).map((entry) => entry.slug)

/** The plugins `trackPlugins` recorded, in the order Payload ran them. */
export const installedPlugins = (config: Pick<Config, "custom">): InstalledPlugin[] => {
  const list: unknown = config.custom?.[KEY]
  return Array.isArray(list) ? (list as InstalledPlugin[]) : []
}

/**
 * The config's plugin list, from plugins keyed by name, each recording `info[key]` and the
 * collections and globals it added in the config's `custom`, which stays on the server. Payload
 * runs plugins one after another, so what a plugin added is what's new after it ran. Payload's
 * plugins carry nothing that tells them apart, so the key is what matches a plugin to its info.
 */
export const trackPlugins = <K extends string>(
  plugins: Record<K, Plugin>,
  info: Record<K, PluginInfo>,
): Plugin[] =>
  (Object.keys(plugins) as K[]).map((key) => async (config) => {
    const before = { collections: slugs(config.collections), globals: slugs(config.globals) }
    const next = await plugins[key](config)
    const entry: InstalledPlugin = {
      ...info[key],
      collections: slugs(next.collections).filter((s) => !before.collections.includes(s)),
      globals: slugs(next.globals).filter((s) => !before.globals.includes(s)),
    }
    return {
      ...next,
      custom: { ...next.custom, [KEY]: [...installedPlugins(next), entry] },
    }
  })
