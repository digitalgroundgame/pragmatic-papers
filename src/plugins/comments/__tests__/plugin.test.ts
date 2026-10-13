import type { CollectionConfig, Config } from "payload"
import { describe, expect, it } from "vitest"

import { commentsPlugin, type CommentsPluginConfig } from ".."

const options: CommentsPluginConfig = {
  currentUser: async () => null,
  baseURL: () => "https://example.com",
  moderators: () => true,
  admins: () => true,
}

const existingHook = () => undefined
const articles: CollectionConfig = {
  slug: "articles",
  fields: [],
  hooks: { beforeDelete: [existingHook] },
}
const users: CollectionConfig = { slug: "users", auth: true, fields: [] }
const pages: CollectionConfig = { slug: "pages", fields: [] }

const apply = (pluginOptions: CommentsPluginConfig, config: Partial<Config> = {}) =>
  commentsPlugin(pluginOptions)({
    collections: [articles, users, pages],
    ...config,
  } as Config) as Config

const collection = (config: Config, slug: string) =>
  config.collections!.find((c) => c.slug === slug)!
const field = (config: Config, slug: string, name: string) =>
  collection(config, slug).fields.find((f) => "name" in f && f.name === name)

describe("commentsPlugin", () => {
  it("adds comments, violations and the settings global, in the group it's given", () => {
    const config = apply({ ...options, adminGroup: "Community" })

    expect(config.collections!.map(({ slug }) => slug)).toEqual([
      "articles",
      "users",
      "pages",
      "comments",
      "comment-violations",
    ])
    expect(config.globals!.map(({ slug }) => slug)).toEqual(["comment-settings"])
    expect(collection(config, "comments").admin?.group).toBe("Community")
    expect(collection(config, "comment-violations").admin?.group).toBe("Community")
    expect(config.globals![0]!.admin?.group).toBe("Community")
  })

  it("cleans up after an article and an author, after their own hooks", () => {
    const config = apply(options)

    expect(collection(config, "articles").hooks?.beforeDelete).toHaveLength(2)
    expect(collection(config, "articles").hooks?.beforeDelete?.[0]).toBe(existingHook)
    expect(collection(config, "users").hooks?.beforeDelete).toHaveLength(1)
    expect(collection(config, "pages")).toBe(pages)
  })

  it("points comments at the collections it's given", () => {
    const config = apply({ ...options, targetSlug: "pages", authorsSlug: "articles" })

    expect(field(config, "comments", "target")).toMatchObject({ relationTo: "pages" })
    expect(field(config, "comments", "author")).toMatchObject({ relationTo: "articles" })
    expect(field(config, "comment-violations", "author")).toMatchObject({ relationTo: "articles" })
  })

  it("keeps a comment's author optional, so a deleted account can leave its replies", () => {
    expect(field(apply(options), "comments", "author")).not.toHaveProperty("required")
  })

  it("lets nobody create a comment through Payload, and admins alone change the settings", () => {
    const admins = () => false
    const config = apply({ ...options, admins })

    expect(collection(config, "comments").access?.create?.({} as never)).toBe(false)
    expect(config.globals![0]!.access?.update).toBe(admins)
    expect(config.globals![0]!.access?.read).toBe(options.moderators)
  })

  it("serves the thread endpoints, and none when disabled", () => {
    const endpoints = (config: Config) =>
      (collection(config, "comments").endpoints || []).map(
        ({ method, path }) => `${method} ${path}`,
      )

    expect(endpoints(apply(options))).toEqual(["get /thread/:id", "post /thread/:id"])

    const disabled = apply({ ...options, disabled: true })
    expect(endpoints(disabled)).toEqual([])
    expect(disabled.collections!.map(({ slug }) => slug)).toContain("comment-violations")
  })
})
