import { type Config, definePlugin, type Payload, type Plugin } from "payload"

/** What a plugin says about itself, the way a WordPress plugin's header does. */
export interface PluginManifest {
  name: string
  /** The package it comes from, or the folder of one of ours. */
  source: string
  description: string
  /**
   * Whether it's on here: a constant, or a switch asked when someone looks. Leave it out for a
   * plugin that's always on.
   */
  enabled?: boolean | ((payload: Payload) => boolean | Promise<boolean>)
}

/** A plugin as the config records it: its manifest, and the collections and globals it added. */
export interface RegisteredPlugin extends PluginManifest {
  slug: string
  collections: string[]
  globals: string[]
}

const KEY = "registeredPlugins"

const slugs = (entries: { slug: string }[] | undefined): string[] =>
  (entries ?? []).map((entry) => entry.slug)

/** Every plugin `registerPlugin` recorded, in the order Payload ran them. */
export const registeredPlugins = (config: Pick<Config, "custom">): RegisteredPlugin[] => {
  const list: unknown = config.custom?.[KEY]
  return Array.isArray(list) ? (list as RegisteredPlugin[]) : []
}

/**
 * A Payload plugin, under Payload's `slug` (`definePlugin`), that records its manifest and the
 * collections and globals it added in the config's `custom`, which stays on the server, for an
 * admin page to list. Our plugins call it with their own manifest; a package that doesn't
 * describe itself is wrapped where the site installs it.
 */
export const registerPlugin = (
  slug: string,
  manifest: PluginManifest,
  plugin: (config: Config) => Config | Promise<Config>,
): Plugin =>
  definePlugin({
    slug,
    plugin: ({ config }) => {
      const before = { collections: slugs(config.collections), globals: slugs(config.globals) }
      const record = (next: Config): Config => {
        const entry: RegisteredPlugin = {
          ...manifest,
          slug,
          collections: slugs(next.collections).filter((s) => !before.collections.includes(s)),
          globals: slugs(next.globals).filter((s) => !before.globals.includes(s)),
        }
        return { ...next, custom: { ...next.custom, [KEY]: [...registeredPlugins(next), entry] } }
      }
      // A plugin that returns its config at once still does, so callers needn't await it.
      const next = plugin(config)
      return next instanceof Promise ? next.then(record) : record(next)
    },
  })()
