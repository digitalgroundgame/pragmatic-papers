import { nestedDocsPlugin } from "@payloadcms/plugin-nested-docs"
import type { Access, Config, Field, PayloadRequest, TextField } from "payload"
import { afterEach, describe, expect, it, vi } from "vitest"

import { Docs } from "../collection"

const update = Docs.access!.update as Access
const req = (roles?: string[]) =>
  ({ user: roles ? { id: 1, collection: "users", roles } : null }) as unknown as PayloadRequest

afterEach(() => vi.unstubAllEnvs())

describe("Docs access: update", () => {
  it("refuses anyone below editor", () => {
    expect(update({ req: req() })).toBe(false)
    expect(update({ req: req(["writer"]) })).toBe(false)
  })

  it("lets editors change any doc, including ones seeded from the repo", () => {
    vi.stubEnv("NODE_ENV", "production")
    expect(update({ req: req(["editor"]) })).toBe(true)
  })
})

describe("Docs fields: sourceHash", () => {
  const field = Docs.fields.find((f) => "name" in f && f.name === "sourceHash") as TextField
  const condition = field.admin!.condition!

  it("shows only on a doc that came from the repo", () => {
    const args = {} as Parameters<typeof condition>[2]
    expect(condition({ sourceHash: "abc" }, {}, args)).toBe(true)
    expect(condition({}, {}, args)).toBe(false)
  })
})

describe("Docs fields: tour", () => {
  const field = Docs.fields.find((f) => "name" in f && f.name === "tour") as TextField
  const validate = (value: string | null | undefined) =>
    (field.validate as unknown as (value: string | null | undefined) => true | string)(value)

  it("takes no tour, or one that exists", () => {
    expect(validate(undefined)).toBe(true)
    expect(validate("")).toBe(true)
    expect(validate("articles")).toBe(true)
  })

  it("refuses a name that isn't a tour, inherited ones included", () => {
    expect(validate("nope")).toBe('No tour is called "nope".')
    expect(validate("toString")).toBe('No tour is called "toString".')
  })

  it("lists the tours an editor can name", () => {
    expect(field.admin!.description).toContain("One of: articles.")
  })
})

describe("Docs admin: preview", () => {
  it("previews a doc at /docs/<slug>", () => {
    const previewReq = { headers: new Headers() } as unknown as PayloadRequest
    const preview = Docs.admin!.preview!(
      { slug: "experiments" },
      {
        req: previewReq,
        locale: "",
        token: null,
      },
    )
    const live = Docs.admin!.livePreview!.url as (args: unknown) => string | null
    for (const url of [preview, live({ data: { slug: "experiments" }, req: previewReq })]) {
      expect(String(url)).toContain("slug=experiments")
      expect(String(url)).toContain(encodeURIComponent("/docs/experiments"))
    }
  })
})

describe("Docs admin: layout", () => {
  // The collection as the docs plugin installs it, with the nested docs plugin's fields.
  const { collections } = nestedDocsPlugin({ collections: ["docs"] })({
    collections: [Docs],
  } as Config) as Config
  const installed = collections!.find((collection) => collection.slug === "docs")!

  // The visible fields in the sidebar, in order. A row (the slug's) goes there whole.
  const sidebar = (fields: Field[], inSidebar = false): string[] =>
    fields.flatMap((field) => {
      const here = inSidebar || field.admin?.position === "sidebar"
      if (field.type === "row") return sidebar(field.fields, here)
      return "name" in field &&
        here &&
        !(field.admin && "hidden" in field.admin && field.admin.hidden)
        ? [field.name]
        : []
    })

  it("orders the sidebar from the hero down to the tour", () => {
    expect(sidebar(installed.fields)).toEqual([
      "heroImage",
      "publishedAt",
      "revisedAt",
      "slug",
      "parent",
      "audience",
      "showTableOfContents",
      "tour",
      "sourceHash",
    ])
  })

  it("keeps one parent field, with the nested docs plugin's filter", () => {
    const parents = installed.fields.filter(
      (field: Field) => "name" in field && field.name === "parent",
    )
    expect(parents).toHaveLength(1)
    expect(parents[0]).toHaveProperty("filterOptions")
  })

  it("lists docs by title, sidebar title, parent, audience, update and status", () => {
    expect(Docs.admin!.defaultColumns).toEqual([
      "title",
      "navTitle",
      "parent",
      "audience",
      "updatedAt",
      "_status",
    ])
  })
})
