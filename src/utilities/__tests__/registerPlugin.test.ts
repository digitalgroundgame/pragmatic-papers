import type { Config, Payload, Plugin } from "payload"
import { describe, expect, it } from "vitest"

import {
  describePlugin,
  isPluginOn,
  registeredPlugins,
  registerPlugin,
  type SitePluginOptions,
} from "../registerPlugin"

const base = (): Config =>
  ({
    collections: [{ slug: "articles", fields: [] }],
    globals: [{ slug: "header", fields: [] }],
  }) as unknown as Config

const addsCollection =
  (slug: string): Plugin =>
  (config) => ({ ...config, collections: [...(config.collections ?? []), { slug, fields: [] }] })

const addsGlobal: Plugin = (config) => ({
  ...config,
  globals: [...(config.globals ?? []), { slug: "plugin-settings", fields: [] }],
})

const run = async (config: Config, list: Plugin[]): Promise<Config> => {
  for (const plugin of list) config = await plugin(config)
  return config
}

const manifest = (name: string) => ({ name, source: name.toLowerCase(), description: "" })

describe("registerPlugin", () => {
  it("makes a plugin the way Payload's definePlugin does, carrying its manifest", () => {
    const plugin = registerPlugin<SitePluginOptions & { label?: string }>({
      slug: "first",
      order: 5,
      manifest: manifest("First"),
      plugin: ({ config }) => config,
    })({ label: "x" })

    expect(plugin.slug).toBe("first")
    expect(plugin.order).toBe(5)
    expect(plugin.options).toEqual({ label: "x" })
    expect(plugin.manifest).toEqual(manifest("First"))
  })

  it("hands the plugin its options and the other plugins, by slug", async () => {
    const seen: unknown[] = []
    const other = describePlugin(addsGlobal, { slug: "other", manifest: manifest("Other") })
    const plugin = registerPlugin<SitePluginOptions & { label?: string }>({
      slug: "first",
      manifest: manifest("First"),
      plugin: ({ config, plugins, label }) => {
        seen.push(label, plugins.other?.slug)
        return config
      },
    })({ label: "x" })

    await plugin({ ...base(), plugins: [other, plugin] })
    expect(seen).toEqual(["x", "other"])
  })

  it("records each plugin's manifest, its enabled option and what it added, in order", async () => {
    const enabled = async () => true
    const config = await run(base(), [
      registerPlugin({
        slug: "first",
        manifest: manifest("First"),
        plugin: ({ config: c }) => addsCollection("one")(c),
      })({ enabled }),
      describePlugin(addsGlobal, { slug: "second", manifest: manifest("Second"), enabled: false }),
    ])

    expect(registeredPlugins(config)).toEqual([
      { ...manifest("First"), slug: "first", enabled, collections: ["one"], globals: [] },
      {
        ...manifest("Second"),
        slug: "second",
        enabled: false,
        collections: [],
        globals: ["plugin-settings"],
      },
    ])
    expect(config.collections?.map((c) => c.slug)).toEqual(["articles", "one"])
  })

  it("records a disabled plugin as off, whatever its switch says", async () => {
    const config = await run(base(), [
      registerPlugin({ slug: "a", manifest: manifest("A"), plugin: ({ config: c }) => c })({
        enabled: true,
        disabled: true,
      }),
    ])
    expect(registeredPlugins(config)[0]?.enabled).toBe(false)
  })

  it("keeps what's already in custom", async () => {
    const config = await run({ ...base(), custom: { tours: { enabled: true } } }, [
      describePlugin(addsCollection("a"), { slug: "a", manifest: manifest("A") }),
    ])
    expect(config.custom?.tours).toEqual({ enabled: true })
  })

  it("keeps a package's own order", () => {
    const ordered: Plugin = Object.assign((config: Config) => config, { order: 7 })
    expect(describePlugin(ordered, { slug: "a", manifest: manifest("A") }).order).toBe(7)
  })

  it("keeps a plugin that returns its config at once synchronous", () => {
    const result = describePlugin(addsGlobal, { slug: "a", manifest: manifest("A") })(base())
    expect(result).not.toBeInstanceOf(Promise)
  })

  it("lists nothing for a config no registered plugin ran on", () => {
    expect(registeredPlugins(base())).toEqual([])
    expect(registeredPlugins({ custom: { registeredPlugins: "nope" } })).toEqual([])
  })
})

describe("isPluginOn", () => {
  const payload = {} as Payload

  it("is on when unset, and reads a constant or a switch otherwise", async () => {
    expect(await isPluginOn(undefined, payload)).toBe(true)
    expect(await isPluginOn(false, payload)).toBe(false)
    expect(await isPluginOn(async (p) => p === payload, payload)).toBe(true)
  })
})
