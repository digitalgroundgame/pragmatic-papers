import type { Config, Plugin } from "payload"
import { describe, expect, it } from "vitest"

import { registeredPlugins, registerPlugin } from "../registerPlugin"

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
  it("gives the plugin Payload's slug", () => {
    expect(registerPlugin("first", manifest("First"), addsGlobal).slug).toBe("first")
  })

  it("records each plugin's manifest and what it added, in the order they ran", async () => {
    const config = await run(base(), [
      registerPlugin("first", manifest("First"), addsCollection("one")),
      registerPlugin("second", manifest("Second"), addsGlobal),
    ])

    expect(registeredPlugins(config)).toEqual([
      { ...manifest("First"), slug: "first", collections: ["one"], globals: [] },
      { ...manifest("Second"), slug: "second", collections: [], globals: ["plugin-settings"] },
    ])
    expect(config.collections?.map((c) => c.slug)).toEqual(["articles", "one"])
  })

  it("keeps what's already in custom", async () => {
    const config = await run({ ...base(), custom: { tours: { enabled: true } } }, [
      registerPlugin("a", manifest("A"), addsCollection("a")),
    ])
    expect(config.custom?.tours).toEqual({ enabled: true })
  })

  it("lists nothing for a config no registered plugin ran on", () => {
    expect(registeredPlugins(base())).toEqual([])
    expect(registeredPlugins({ custom: { registeredPlugins: "nope" } })).toEqual([])
  })
})
