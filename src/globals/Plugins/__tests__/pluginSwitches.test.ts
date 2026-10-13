import type { Config, GroupField } from "payload"
import { describe, expect, it } from "vitest"

import { registerPlugin } from "@/utilities/registerPlugin"

import { pluginSwitches, PLUGINS_SLUG } from "../pluginSwitches"

const base = (): Config =>
  ({
    collections: [],
    globals: [
      { slug: PLUGINS_SLUG, fields: [] },
      { slug: "header", fields: [] },
    ],
  }) as unknown as Config

const manifest = (withSwitch: boolean) => ({
  name: "Plugin",
  source: "src/plugins/x",
  description: "",
  ...(withSwitch && {
    switch: { label: "Help docs", description: "The docs.", defaultValue: false },
  }),
})

const run = async (config: Config, slugs: Record<string, boolean>) => {
  for (const [slug, withSwitch] of Object.entries(slugs)) {
    config = await registerPlugin(slug, manifest(withSwitch), (c) => c)(config)
  }
  return pluginSwitches()(config)
}

const switches = (config: Config) =>
  config.globals
    ?.find((g) => g.slug === PLUGINS_SLUG)
    ?.fields.find((f): f is GroupField => "name" in f && f.name === "switches")

describe("pluginSwitches", () => {
  it("runs after every other plugin", () => {
    expect(pluginSwitches().order).toBeGreaterThan(0)
  })

  it("adds a switch for each plugin that offers one, named for its slug", async () => {
    const group = switches(await run(base(), { docs: true, "plugin-seo": false, tours: true }))
    expect(group?.fields).toEqual([
      expect.objectContaining({
        name: "docs",
        type: "checkbox",
        label: "Help docs",
        defaultValue: false,
        admin: expect.objectContaining({ description: "The docs." }),
      }),
      expect.objectContaining({ name: "tours" }),
    ])
  })

  it("adds no group when no plugin offers a switch", async () => {
    expect(switches(await run(base(), { "plugin-seo": false }))).toBeUndefined()
  })

  it("refuses a switch whose slug can't name a column", async () => {
    await expect(run(base(), { "my-plugin": true })).rejects.toThrow("camelCase")
  })
})
