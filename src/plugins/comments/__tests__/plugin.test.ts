import type { CollectionConfig, Config } from "payload"
import { describe, expect, it } from "vitest"

import { commentsPlugin, type CommentsPluginConfig } from ".."
import { toPublicComment } from "../endpoints/thread"

const options: CommentsPluginConfig = {
  providers: () => ({}),
  baseURL: () => "https://example.com",
  secret: () => "secret",
  moderators: () => true,
}

const existingHook = () => undefined
const articles: CollectionConfig = {
  slug: "articles",
  fields: [],
  hooks: { beforeDelete: [existingHook] },
}
const pages: CollectionConfig = { slug: "pages", fields: [] }

const apply = (pluginOptions: CommentsPluginConfig, config: Partial<Config> = {}) =>
  commentsPlugin(pluginOptions)({ collections: [articles, pages], ...config } as Config) as Config

const collection = (config: Config, slug: string) =>
  config.collections!.find((c) => c.slug === slug)!

describe("commentsPlugin", () => {
  it("adds the readers and comments collections, in the group it's given", () => {
    const config = apply({ ...options, adminGroup: "Community" })

    expect(config.collections!.map(({ slug }) => slug)).toEqual([
      "articles",
      "pages",
      "readers",
      "comments",
    ])
    expect(collection(config, "readers").admin?.group).toBe("Community")
    expect(collection(config, "comments").admin?.group).toBe("Community")
  })

  it("deletes an article's comments with it, after the article's own hooks", () => {
    const config = apply(options)

    expect(collection(config, "articles").hooks?.beforeDelete).toHaveLength(2)
    expect(collection(config, "articles").hooks?.beforeDelete?.[0]).toBe(existingHook)
    expect(collection(config, "pages")).toBe(pages)
  })

  it("takes comments on the collection it's pointed at", () => {
    const config = apply({ ...options, targetSlug: "pages" })
    const target = collection(config, "comments").fields.find(
      (field) => "name" in field && field.name === "target",
    )

    expect(target).toMatchObject({ relationTo: "pages" })
    expect(collection(config, "pages").hooks?.beforeDelete).toHaveLength(1)
  })

  it("lets nobody create a comment or a reader through Payload", () => {
    const config = apply(options)
    for (const slug of ["readers", "comments"]) {
      expect(collection(config, slug).access?.create?.({} as never)).toBe(false)
    }
  })

  it("registers the sign-in and thread endpoints", () => {
    const config = apply(options, {
      endpoints: [{ path: "/other", method: "get", handler: () => new Response() }],
    })

    expect(config.endpoints?.map(({ method, path }) => `${method} ${path}`)).toEqual([
      "get /other",
      "get /reader-auth/:path*",
      "post /reader-auth/:path*",
    ])
    expect(
      (collection(config, "comments").endpoints || []).map(
        ({ method, path }) => `${method} ${path}`,
      ),
    ).toEqual(["get /thread/:id", "post /thread/:id"])
  })

  it("leaves the schema but no endpoints when disabled", () => {
    const config = apply({ ...options, disabled: true })

    expect(config.collections!.map(({ slug }) => slug)).toContain("comments")
    expect(config.endpoints).toBeUndefined()
    expect(collection(config, "comments").endpoints).toEqual([])
  })
})

describe("toPublicComment", () => {
  it("names the reader and their picture, nothing else about them", () => {
    expect(
      toPublicComment({
        id: 1,
        body: "Hi",
        createdAt: "2026-10-01T00:00:00.000Z",
        reader: { id: 3, name: "Ada", avatarUrl: "https://example.com/a.png", banned: false },
      }),
    ).toEqual({
      id: 1,
      body: "Hi",
      createdAt: "2026-10-01T00:00:00.000Z",
      author: { name: "Ada", image: "https://example.com/a.png" },
    })
  })

  it("leaves out a comment whose reader is gone", () => {
    expect(toPublicComment({ id: 1, body: "Hi", createdAt: "", reader: null })).toBeNull()
    expect(toPublicComment({ id: 1, body: "Hi", createdAt: "", reader: 3 })).toBeNull()
  })
})
