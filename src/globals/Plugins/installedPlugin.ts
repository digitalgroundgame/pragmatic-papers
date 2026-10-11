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

/** The plugins `installedPlugin` recorded, in the order Payload ran them. */
export const installedPlugins = (config: Pick<Config, "custom">): InstalledPlugin[] => {
  const list: unknown = config.custom?.[KEY]
  return Array.isArray(list) ? (list as InstalledPlugin[]) : []
}

/**
 * Wraps a plugin so System → Plugins lists it: runs it, then records `info` and the collections
 * and globals it added in the config's `custom`, which stays on the server. Payload runs plugins
 * one after another, so what a plugin added is what's new after it ran.
 */
export const installedPlugin =
  (info: PluginInfo, plugin: Plugin): Plugin =>
  async (config) => {
    const before = { collections: slugs(config.collections), globals: slugs(config.globals) }
    const next = await plugin(config)
    const entry: InstalledPlugin = {
      ...info,
      collections: slugs(next.collections).filter((s) => !before.collections.includes(s)),
      globals: slugs(next.globals).filter((s) => !before.globals.includes(s)),
    }
    return {
      ...next,
      custom: { ...next.custom, [KEY]: [...installedPlugins(next), entry] },
    }
  }
