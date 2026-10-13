import type { CollectionConfig, Config, Payload } from "payload"
import { describe, expect, it, vi } from "vitest"

import { registeredPlugins } from "@/utilities/registerPlugin"

import { ssoPlugin, type SsoPluginConfig } from ".."

const options: SsoPluginConfig = {
  providers: () => ({}),
  baseURL: () => "https://example.com",
  secret: () => "secret",
}

const users: CollectionConfig = {
  slug: "users",
  auth: { tokenExpiration: 7200 },
  fields: [{ name: "name", type: "text" }],
  hooks: { afterLogout: [() => undefined] },
}
const articles: CollectionConfig = { slug: "articles", fields: [] }

const apply = (pluginOptions: SsoPluginConfig, config: Partial<Config> = {}) =>
  ssoPlugin(pluginOptions)({ collections: [users, articles], ...config } as Config) as Config

const usersOf = (config: Config) => config.collections!.find(({ slug }) => slug === "users")!
const fieldNames = (collection: CollectionConfig) =>
  collection.fields.map((field) => ("name" in field ? field.name : null))

describe("ssoPlugin", () => {
  it("adds Better Auth's hidden columns to the users collection only", () => {
    const config = apply(options)
    expect(fieldNames(usersOf(config))).toEqual(["name", "emailVerified", "avatarUrl"])
    expect(config.collections![1]).toBe(articles)
  })

  it("keeps both columns out of reach of the admin and the API", () => {
    for (const field of usersOf(apply(options)).fields.slice(1)) {
      if (!("access" in field) || !field.access) throw new Error("no access")
      expect(field.access.create?.({} as never)).toBe(false)
      expect(field.access.read?.({} as never)).toBe(false)
      expect(field.access.update?.({} as never)).toBe(false)
      expect(field.admin?.hidden).toBe(true)
    }
  })

  it("keeps the users collection's auth settings and hooks, adding its own beside them", () => {
    const collection = usersOf(apply(options))
    const auth = collection.auth as Exclude<CollectionConfig["auth"], boolean | undefined>

    expect(auth.tokenExpiration).toBe(7200)
    expect(auth.strategies?.map(({ name }) => name)).toEqual(["sso"])
    expect(collection.hooks?.afterLogout).toHaveLength(2)
  })

  it("registers its endpoints and the login page's buttons", () => {
    const config = apply(options, {
      endpoints: [{ path: "/other", method: "get", handler: () => new Response() }],
      admin: { components: { beforeLogin: ["@/other#Other"] } },
    })

    expect(config.endpoints?.map(({ path }) => path)).toEqual([
      "/other",
      "/auth/:path*",
      "/auth/:path*",
    ])
    expect(config.admin?.components?.beforeLogin).toEqual([
      "@/other#Other",
      expect.objectContaining({ path: "@/plugins/sso/exports/rsc#SignIn" }),
    ])
  })

  it("hands the buttons its options, with defaults filled in", async () => {
    const [, signIn] = apply(options, { admin: { components: { beforeLogin: ["@/o#O"] } } }).admin!
      .components!.beforeLogin as [unknown, { serverProps: { sso: Record<string, unknown> } }]

    expect(signIn.serverProps.sso).toMatchObject({
      usersSlug: "users",
      cookieName: "payload-token-sso",
      sessionSeconds: 60 * 60 * 24 * 7,
      requiredUserColumns: [],
    })
    const enabled = signIn.serverProps.sso.enabled as (args: {
      payload: Payload
    }) => Promise<boolean>
    expect(await enabled({ payload: {} as Payload })).toBe(true)
  })

  it("keeps the schema but registers nothing else when disabled", () => {
    const config = apply({ ...options, disabled: true })
    const collection = usersOf(config)

    expect(fieldNames(collection)).toEqual(["name", "emailVerified", "avatarUrl"])
    expect(collection.auth).toEqual(users.auth)
    expect(collection.hooks).toBe(users.hooks)
    expect(config.endpoints).toBeUndefined()
    expect(config.admin).toBeUndefined()
  })

  it("adds to the collection named by usersSlug", () => {
    const config = apply({ ...options, usersSlug: "articles" })
    expect(fieldNames(usersOf(config))).toEqual(["name"])
    expect(fieldNames(config.collections![1]!)).toEqual(["emailVerified", "avatarUrl"])
  })

  it("lists itself on System → Plugins, asking its own switch", async () => {
    const payload = {} as Payload
    const enabled = vi.fn(async () => true)
    const [entry] = registeredPlugins(apply({ ...options, enabled }))
    expect(entry).toMatchObject({ slug: "sso", name: "SSO" })
    if (typeof entry?.enabled !== "function") throw new Error("no switch")
    expect(await entry.enabled(payload)).toBe(true)
    expect(enabled).toHaveBeenCalledWith(payload)

    expect(registeredPlugins(apply({ ...options, disabled: true }))[0]?.enabled).toBe(false)
  })
})
