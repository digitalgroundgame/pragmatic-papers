import type { Payload } from "payload"
import { describe, expect, it } from "vitest"

import type { User } from "@/payload-types"

import type { RegisteredPlugin } from "@/utilities/registerPlugin"

import { loadPlugins } from "../load"

const admin = { id: 1, roles: ["admin"] } as unknown as User

const plugin = (overrides: Partial<RegisteredPlugin>): RegisteredPlugin => ({
  slug: "plugin",
  name: "Plugin",
  source: "@payloadcms/plugin",
  description: "Does a thing.",
  collections: [],
  globals: [],
  ...overrides,
})

const config = (registeredPlugins: RegisteredPlugin[], adminRoute = "/admin") =>
  ({
    config: {
      routes: { admin: adminRoute },
      custom: { registeredPlugins },
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
    },
  }) as unknown as Pick<Payload, "config">

describe("loadPlugins", () => {
  it("links the collections and globals a plugin added", async () => {
    const [row] = await loadPlugins(
      config([plugin({ collections: ["search", "forms"], globals: ["site-settings"] })]),
      admin,
    )
    expect(row?.pages).toEqual([
      { label: "Search", href: "/admin/collections/search" },
      { label: "Forms", href: null },
      { label: "Settings", href: "/admin/globals/site-settings" },
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

  it("marks a plugin whose switch starts off as a beta", async () => {
    const theSwitch = { label: "On", description: "", defaultValue: false }
    const rows = await loadPlugins(
      config([
        plugin({ name: "Package" }),
        plugin({ name: "Beta", switch: theSwitch }),
        plugin({ name: "Graduated", switch: { ...theSwitch, defaultValue: true } }),
      ]),
      admin,
    )
    expect(rows.map((r) => [r.name, r.beta])).toEqual([
      ["Package", false],
      ["Beta", true],
      ["Graduated", false],
    ])
  })

  it("reads each plugin's switch now", async () => {
    const rows = await loadPlugins(
      config([
        plugin({ name: "Always" }),
        plugin({ name: "Env off", enabled: false }),
        plugin({ name: "Experiment on", enabled: async () => true }),
        plugin({
          name: "Asks Payload",
          enabled: (payload) => payload.config.routes.admin === "/admin",
        }),
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
      ["Asks Payload", "on"],
      ["Broken", "unknown"],
    ])
  })
})
