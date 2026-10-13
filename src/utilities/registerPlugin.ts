import { type Config, definePlugin, type Payload, type Plugin, type PluginsMap } from "payload"

/**
 * An on/off switch an admin can flip without a deploy, which a plugin offers when it checks
 * `enabled` on each request. The host decides where the switch lives and passes its reading in
 * as the plugin's `enabled` option.
 */
export interface PluginSwitch {
  label: string
  /** What switching it off takes away. */
  description: string
  /** Whether it's on before anyone touches it: off while it's a beta. */
  defaultValue: boolean
}

/** What a plugin says about itself, the way a WordPress plugin's header does. */
export interface PluginManifest {
  name: string
  /** The package it comes from, or the folder of one of ours. */
  source: string
  description: string
  switch?: PluginSwitch
}

/** Whether a plugin is on here: a constant, or a switch asked when someone looks. */
export type PluginEnabled = boolean | ((payload: Payload) => boolean | Promise<boolean>)

/** The options every plugin `registerPlugin` defines takes, beside its own. */
export interface SitePluginOptions {
  /**
   * Whether it's on, checked at runtime (a switch's reading). Its schema stays either way.
   * Always on, when unset.
   */
  enabled?: PluginEnabled
  /** Off in code: the plugin leaves its schema in place but registers no behavior. */
  disabled?: boolean
}

/** A Payload plugin that carries its manifest, beside Payload's `slug` and `options`. */
export type SitePlugin = Plugin & { manifest: PluginManifest }

/** A plugin as the config records it: its manifest, and the collections and globals it added. */
export interface RegisteredPlugin extends PluginManifest {
  slug: string
  /** Its `enabled` option, or `false` when it's `disabled`; unset when it's always on. */
  enabled?: PluginEnabled
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

/** Runs `run` on `config` and records `entry`, with the collections and globals it added. */
const recording = (
  config: Config,
  entry: Omit<RegisteredPlugin, "collections" | "globals">,
  run: (config: Config) => Config | Promise<Config>,
): Config | Promise<Config> => {
  const before = { collections: slugs(config.collections), globals: slugs(config.globals) }
  const record = (next: Config): Config => {
    const registered: RegisteredPlugin = {
      ...entry,
      collections: slugs(next.collections).filter((s) => !before.collections.includes(s)),
      globals: slugs(next.globals).filter((s) => !before.globals.includes(s)),
    }
    return { ...next, custom: { ...next.custom, [KEY]: [...registeredPlugins(next), registered] } }
  }
  // A plugin that returns its config at once still does, so callers needn't await it.
  const next = run(config)
  return next instanceof Promise ? next.then(record) : record(next)
}

/** A plugin's options, which it can be called without when none is required. */
type OptionsArgs<TOptions> =
  Partial<TOptions> extends TOptions ? [options?: TOptions] : [options: TOptions]

const enabledOf = ({ enabled, disabled }: SitePluginOptions): PluginEnabled | undefined =>
  disabled ? false : enabled

/**
 * Payload's `definePlugin`, plus a `manifest` that System → Plugins lists, and the `enabled`
 * and `disabled` options every one of our plugins takes. The descriptor is Payload's own with
 * one key added, so once Payload covers what the manifest does, dropping that key is the move.
 *
 * The plugin it makes carries its manifest beside Payload's `slug` and `options`, for other
 * plugins to read from the `plugins` map. Running it records the manifest and what the plugin
 * added in the config's `custom`, which stays on the server.
 */
export const registerPlugin =
  <TOptions extends SitePluginOptions = SitePluginOptions>(descriptor: {
    slug: string
    order?: number
    manifest: PluginManifest
    plugin: (args: { config: Config; plugins: PluginsMap } & TOptions) => Config | Promise<Config>
  }): ((...args: OptionsArgs<TOptions>) => SitePlugin) =>
  (...[options = {} as TOptions]: OptionsArgs<TOptions>) => {
    const { manifest, plugin, ...payloadDescriptor } = descriptor
    const defined = definePlugin<TOptions & Record<string, unknown>>({
      ...payloadDescriptor,
      plugin: (args) =>
        recording(
          args.config,
          { ...manifest, slug: descriptor.slug, enabled: enabledOf(options) },
          (config) => plugin({ ...args, config }),
        ),
    })(options as TOptions & Record<string, unknown>)
    return Object.assign(defined, { manifest })
  }

/**
 * A package's plugin, described for System → Plugins where the site installs it, until the
 * package describes itself. It keeps the package's own `order`.
 */
export const describePlugin = (
  plugin: Plugin,
  { slug, manifest, enabled }: { slug: string; manifest: PluginManifest; enabled?: PluginEnabled },
): SitePlugin =>
  registerPlugin({ slug, order: plugin.order, manifest, plugin: ({ config }) => plugin(config) })({
    enabled,
  })

/** Reads a plugin's `enabled` option: on when it's unset. */
export const isPluginOn = async (
  enabled: PluginEnabled | undefined,
  payload: Payload,
): Promise<boolean> =>
  enabled === undefined || (typeof enabled === "function" ? await enabled(payload) : enabled)
