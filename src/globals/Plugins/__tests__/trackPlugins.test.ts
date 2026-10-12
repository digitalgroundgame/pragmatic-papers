import type { Config, Plugin } from "payload"
import { describe, expect, it } from "vitest"

import { plugins } from "@/plugins"
import { PLUGIN_INFO } from "@/plugins/catalog"

import { installedPlugins, trackPlugins } from "../trackPlugins"

const base = (): Config =>
  ({
    collections: [{ slug: "articles", fields: [] }],
    globals: [{ slug: "header", fields: [] }],
  }) as unknown as Config

const addsCollection =
  (slug: string): Plugin =>
  (config) => ({ ...config, collections: [...(config.collections ?? []), { slug, fields: [] }] })

const run = async (config: Config, list: Plugin[]): Promise<Config> => {
  for (const plugin of list) config = await plugin(config)
  return config
}

const info = (name: string) => ({ name, source: name.toLowerCase(), description: "" })

describe("trackPlugins", () => {
  it("records each plugin with what it added, in the order they ran", async () => {
    const addsGlobal: Plugin = (config) => ({
      ...config,
      globals: [...(config.globals ?? []), { slug: "plugin-settings", fields: [] }],
    })
    const config = await run(
      base(),
      trackPlugins(
        { first: addsCollection("one"), second: addsGlobal },
        { first: info("First"), second: info("Second") },
      ),
    )

    expect(installedPlugins(config)).toEqual([
      { ...info("First"), collections: ["one"], globals: [] },
      { ...info("Second"), collections: [], globals: ["plugin-settings"] },
    ])
    expect(config.collections?.map((c) => c.slug)).toEqual(["articles", "one"])
  })

  it("keeps what's already in custom", async () => {
    const config = await run(
      { ...base(), custom: { tours: { enabled: true } } },
      trackPlugins({ a: addsCollection("a") }, { a: info("A") }),
    )
    expect(config.custom?.tours).toEqual({ enabled: true })
  })

  it("lists nothing for a config no tracked plugin ran on", () => {
    expect(installedPlugins(base())).toEqual([])
    expect(installedPlugins({ custom: { installedPlugins: "nope" } })).toEqual([])
  })
})

describe("the site's plugins", () => {
  it("are all listed on System → Plugins", async () => {
    const config = await run(
      {
        ...base(),
        collections: ["articles", "pages", "volumes", "topics", "interactives", "categories"].map(
          (slug) => ({ slug, fields: [] }),
        ),
      } as unknown as Config,
      trackPlugins({ ...plugins, sentry: (c: Config) => c }, PLUGIN_INFO),
    )
    const listed = installedPlugins(config)

    expect(listed.map((p) => p.name)).toEqual(Object.values(PLUGIN_INFO).map((p) => p.name))
    expect(listed.find((p) => p.name === "Search")?.collections).toEqual(["search"])
    expect(listed.find((p) => p.name === "Help docs")?.collections).toEqual(["docs"])
    expect(listed.find((p) => p.name === "SEO")?.collections).toEqual([])
  })
})
