import type { Config, Plugin } from "payload"
import { describe, expect, it } from "vitest"

import { plugins } from "@/plugins"

import { installedPlugin, installedPlugins } from "../installedPlugin"

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

describe("installedPlugin", () => {
  it("records each plugin with what it added, in the order they ran", async () => {
    const addsGlobal: Plugin = (config) => ({
      ...config,
      globals: [...(config.globals ?? []), { slug: "plugin-settings", fields: [] }],
    })
    const config = await run(base(), [
      installedPlugin({ name: "First", source: "first", description: "" }, addsCollection("one")),
      installedPlugin({ name: "Second", source: "second", description: "" }, addsGlobal),
    ])

    expect(installedPlugins(config)).toEqual([
      { name: "First", source: "first", description: "", collections: ["one"], globals: [] },
      {
        name: "Second",
        source: "second",
        description: "",
        collections: [],
        globals: ["plugin-settings"],
      },
    ])
    expect(config.collections?.map((c) => c.slug)).toEqual(["articles", "one"])
  })

  it("keeps what's already in custom", async () => {
    const config = await run({ ...base(), custom: { tours: { enabled: true } } }, [
      installedPlugin({ name: "A", source: "a", description: "" }, addsCollection("a")),
    ])
    expect(config.custom?.tours).toEqual({ enabled: true })
  })

  it("lists nothing for a config no wrapped plugin ran on", () => {
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
      plugins,
    )
    const listed = installedPlugins(config)

    expect(listed).toHaveLength(plugins.length)
    expect(new Set(listed.map((p) => p.name)).size).toBe(listed.length)
    expect(listed.find((p) => p.name === "Search")?.collections).toEqual(["search"])
    expect(listed.find((p) => p.name === "Help docs")?.collections).toEqual(["docs"])
    expect(listed.find((p) => p.name === "SEO")?.collections).toEqual([])
  })
})
