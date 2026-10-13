import type { Config } from "payload"
import { describe, expect, it } from "vitest"

import { plugins } from "@/plugins"
import { registeredPlugins } from "@/utilities/registerPlugin"

describe("the site's plugins", () => {
  it("all register themselves for System → Plugins, under unique slugs", async () => {
    let config = {
      collections: ["articles", "pages", "volumes", "topics", "interactives", "categories"].map(
        (slug) => ({ slug, fields: [] }),
      ),
      globals: [],
    } as unknown as Config
    for (const plugin of plugins) config = await plugin(config)
    const listed = registeredPlugins(config)

    expect(listed.map((p) => p.slug)).toEqual(plugins.map((p) => p.slug))
    expect(new Set(listed.map((p) => p.slug)).size).toBe(plugins.length)
    expect(listed.map((p) => p.name)).toEqual([
      "Search",
      "Redirects",
      "Nested docs",
      "SEO",
      "Form builder",
      "S3 storage",
      "Help docs",
      "Notifications",
      "Guided tours",
      "SSO",
    ])
    expect(listed.find((p) => p.slug === "plugin-search")?.collections).toEqual(["search"])
    expect(listed.find((p) => p.slug === "docs")?.collections).toEqual(["docs"])
    expect(listed.find((p) => p.slug === "plugin-seo")?.collections).toEqual([])
  })
})
