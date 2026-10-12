import type { SanitizedConfig } from "payload"
import { describe, expect, it } from "vitest"

import type { User } from "@/payload-types"

import type { InstalledPlugin } from "../../trackPlugins"
import { loadPlugins } from "../load"

const admin = { id: 1, roles: ["admin"] } as unknown as User

const plugin = (overrides: Partial<InstalledPlugin>): InstalledPlugin => ({
  name: "Plugin",
  source: "@payloadcms/plugin",
  description: "Does a thing.",
  collections: [],
  globals: [],
  ...overrides,
})

const config = (installedPlugins: InstalledPlugin[], adminRoute = "/admin") =>
  ({
    routes: { admin: adminRoute },
    custom: { installedPlugins },
    collections: [
      { slug: "search", labels: { plural: "Search" }, admin: {} },
      {
        slug: "forms",
        labels: { plural: { en: "Forms", de: "Formulare" } },
        admin: { hidden: true },
      },
      {
        slug: "docs",
        labels: { plural: () => "Docs" },
        admin: { hidden: ({ user }: { user: User | null }) => !user },
      },
    ],
    globals: [{ slug: "site-settings", label: "Settings", admin: {} }],
  }) as unknown as SanitizedConfig

describe("loadPlugins", () => {
  it("links the collections and globals a plugin added, then its settings", async () => {
    const [row] = await loadPlugins(
      config([
        plugin({
          collections: ["search", "forms"],
          globals: ["site-settings"],
          settings: [{ label: "Settings → Experiments", path: "/globals/site-settings" }],
        }),
      ]),
      admin,
    )
    expect(row?.pages).toEqual([
      { label: "Search", href: "/admin/collections/search" },
      { label: "Forms", href: null },
      { label: "Settings", href: "/admin/globals/site-settings" },
      { label: "Settings → Experiments", href: "/admin/globals/site-settings" },
    ])
  })

  it("asks a collection's hidden function about this user, and falls back to its slug", async () => {
    const plugins = config([plugin({ collections: ["docs", "gone"] })])
    expect((await loadPlugins(plugins, admin))[0]?.pages).toEqual([
      { label: "docs", href: "/admin/collections/docs" },
    ])
    expect((await loadPlugins(plugins, null))[0]?.pages).toEqual([{ label: "docs", href: null }])
  })

  it("builds links under a custom admin route", async () => {
    const [atRoot] = await loadPlugins(config([plugin({ collections: ["search"] })], "/"), admin)
    expect(atRoot?.pages[0]?.href).toBe("/collections/search")
  })

  it("reads each plugin's switch now", async () => {
    const rows = await loadPlugins(
      config([
        plugin({ name: "Always" }),
        plugin({ name: "Env off", enabled: false }),
        plugin({ name: "Experiment on", enabled: async () => true }),
        plugin({
          name: "Broken",
          enabled: async () => {
            throw new Error("database down")
          },
        }),
      ]),
      admin,
    )
    expect(rows.map((r) => [r.name, r.status])).toEqual([
      ["Always", "on"],
      ["Env off", "off"],
      ["Experiment on", "on"],
      ["Broken", "unknown"],
    ])
  })
})
