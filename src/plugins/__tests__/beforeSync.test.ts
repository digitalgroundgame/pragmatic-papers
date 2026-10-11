import type { BeforeSync } from "@payloadcms/plugin-search/types"
import type { Payload } from "payload"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { beforeSync } from "../index"

const find = vi.fn()
const payload = { find, logger: { error: vi.fn() } } as unknown as Payload

type SyncArgs = Parameters<BeforeSync>[0]

const sync = (originalDoc: Record<string, unknown>) =>
  beforeSync({
    originalDoc,
    payload,
    searchDoc: { doc: { relationTo: "articles", value: 1 }, title: "" },
  } as unknown as SyncArgs)

const paragraph = (text: string) => ({
  type: "paragraph",
  version: 1,
  children: [{ type: "text", version: 1, text }],
})

const richText = (...paragraphs: string[]) => ({
  root: { type: "root", version: 1, children: paragraphs.map(paragraph) },
})

describe("search beforeSync", () => {
  beforeEach(() => {
    find.mockReset()
  })

  it("indexes an article's title, excerpt, slug, names, image and body", async () => {
    const result = await sync({
      title: "On Housing",
      slug: "on-housing",
      meta: { description: "Why zoning matters.", image: 9 },
      heroImage: 7,
      authors: [{ id: 1, name: "Jane Doe" }],
      topics: [{ id: 3, name: "Economics" }],
      content: richText("Build   more", "homes."),
    })

    expect(result).toMatchObject({
      doc: { relationTo: "articles", value: 1 },
      title: "On Housing",
      excerpt: "Why zoning matters.",
      slug: "on-housing",
      authors: "Jane Doe",
      topics: "Economics",
      image: 7,
    })
    expect(result.body).toMatch(/^Build more\s?homes\.$/)
    expect(find).not.toHaveBeenCalled()
  })

  it("falls back to a topic's name and description", async () => {
    const result = await sync({ name: "Economics", description: "Markets and money." })

    expect(result).toMatchObject({ title: "Economics", excerpt: "Markets and money." })
  })

  it("takes the SEO image when there's no hero, then a profile image", async () => {
    expect(await sync({ meta: { image: 9 } })).toMatchObject({ image: 9 })
    expect(await sync({ profileImage: 4 })).toMatchObject({ image: 4 })
    expect(await sync({ heroImage: null, meta: { image: null } })).toMatchObject({ image: null })
  })

  it("leaves blanks rather than undefined for a doc with nothing to index", async () => {
    expect(await sync({})).toMatchObject({
      title: "",
      excerpt: "",
      slug: "",
      authors: "",
      topics: "",
      image: null,
      body: "",
    })
  })

  it("caps the body under the search field's limit", async () => {
    const result = await sync({ content: richText("word ".repeat(10_000)) })

    expect(result.body).toHaveLength(39_000)
  })
})
