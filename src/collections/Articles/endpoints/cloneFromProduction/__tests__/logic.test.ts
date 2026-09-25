// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { SourceDoc } from "../source"

vi.mock("@/endpoints/seed/media", () => ({
  createMediaFromURL: vi.fn(async (payload, url: string, alt: string, data: object) =>
    payload.create({ collection: "media", data: { url, alt, ...data } }),
  ),
}))

import { createMediaFromURL } from "@/endpoints/seed/media"

import { ArticleNotFoundError, cloneArticleFromProduction } from "../logic"
import { productionUrl } from "../source"

type Row = Record<string, unknown> & { id: number }

/** Just enough of Payload's Local API for the cloner: an in-memory table per collection. */
function fakePayload(seed: Record<string, Row[]> = {}) {
  const db: Record<string, Row[]> = structuredClone(seed)
  let nextId = 1000
  const table = (collection: string) => (db[collection] ??= [])
  const matches = (row: Row, where: Record<string, { equals?: unknown; in?: unknown[] }>) =>
    Object.entries(where).every(([field, cond]) =>
      "in" in cond ? cond.in!.includes(row[field]) : row[field] === cond.equals,
    )

  const payload = {
    db,
    find: vi.fn(async ({ collection, where }) => ({
      docs: table(collection).filter((row) => matches(row, where ?? {})),
    })),
    findByID: vi.fn(async ({ collection, id }) => table(collection).find((row) => row.id === id)),
    create: vi.fn(async ({ collection, data }) => {
      const row = { ...data, id: nextId++ }
      table(collection).push(row)
      return row
    }),
    update: vi.fn(async ({ collection, id, data }) => {
      const row = table(collection).find((r) => r.id === id)!
      Object.assign(row, data)
      return row
    }),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  }
  return payload
}

const PROD = "https://pragmaticpapers.com"

const paragraph = (...children: unknown[]) => ({ type: "paragraph", version: 1, children })
const text = (t: string) => ({ type: "text", text: t, version: 1 })
const richText = (...children: unknown[]) => ({ root: { type: "root", version: 1, children } })
const block = (fields: Record<string, unknown>) => ({ type: "block", version: 2, fields })
const internalLink = (relationTo: string, value: unknown, label = "link") => ({
  type: "link",
  version: 3,
  fields: { linkType: "internal", newTab: false, doc: { relationTo, value } },
  children: [text(label)],
})

const image = (id: number, name = `img-${id}.webp`): SourceDoc => ({
  id,
  alt: `alt ${id}`,
  url: `https://cdn.example.com/${name}`,
  caption: null,
  sizes: { large: { url: `https://cdn.example.com/large-${name}` } },
})

const author = (id: number, slug: string): SourceDoc => ({
  id,
  name: `Name ${slug}`,
  slug,
  affiliation: "DGG",
  biography: null,
  profileImage: image(id + 500),
  socials: [],
})

function article(overrides: Partial<SourceDoc> & { id: number; slug: string }): SourceDoc {
  return {
    title: `Title ${overrides.slug}`,
    content: richText(paragraph(text("Body"))),
    authors: [],
    topics: [],
    heroImage: null,
    narration: null,
    createdBy: null,
    meta: { title: null, description: "desc", image: null },
    publishedAt: "2026-05-01T00:00:00.000Z",
    enableMathRendering: false,
    ...overrides,
  }
}

/** Fakes production's REST API: articles by slug, docs by ID, and volume membership. */
function fakeProduction({
  articles = [],
  volumes = [],
  docs = {},
  unreachable = [],
}: {
  articles?: SourceDoc[]
  volumes?: SourceDoc[]
  docs?: Record<string, SourceDoc>
  unreachable?: string[]
}) {
  return vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (init?.method === "HEAD") {
      return new Response(null, { status: unreachable.includes(url.href) ? 404 : 200 })
    }
    const json = (body: unknown) => Response.json(body)
    const q = url.searchParams
    if (url.pathname === "/api/articles") {
      return json({ docs: articles.filter((a) => a.slug === q.get("where[slug][equals]")) })
    }
    if (url.pathname === "/api/volumes") {
      const id = Number(q.get("where[articles][contains]"))
      return json({
        docs: volumes.filter((v) => (v.articles as number[]).includes(id)),
      })
    }
    const doc = docs[url.pathname.replace("/api/", "")]
    return doc ? json(doc) : new Response("not found", { status: 404 })
  })
}

describe("cloneArticleFromProduction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("creates the article with its authors, topics, images and volume", async () => {
    const source = article({
      id: 1,
      slug: "housing",
      authors: [author(10, "jane")],
      topics: [{ id: 7, name: "Housing", slug: "housing-topic", description: null, meta: {} }],
      heroImage: image(20),
      createdBy: author(10, "jane"),
    })
    vi.stubGlobal(
      "fetch",
      fakeProduction({
        articles: [source],
        volumes: [
          {
            id: 55,
            title: "Volume XLIX",
            volumeNumber: 49,
            description: "Vol desc",
            slug: "49",
            articles: [1],
            publishedAt: "2026-05-01T00:00:00.000Z",
          },
        ],
      }),
    )
    const payload = fakePayload()

    const result = await cloneArticleFromProduction(payload as never, "housing")

    const [created] = payload.db.articles!
    expect(result).toMatchObject({ id: created!.id, slug: "housing", title: "Title housing" })
    expect(result.created).toEqual({ articles: 1, users: 1, media: 2, topics: 1, volumes: 1 })

    const [user] = payload.db.users!
    const [topic] = payload.db.topics!
    const hero = payload.db.media!.find((m) => m.url === "https://cdn.example.com/img-20.webp")
    expect(created).toMatchObject({
      generateSlug: false,
      _status: "published",
      publishedAt: "2026-05-01T00:00:00.000Z",
      authors: [user!.id],
      createdBy: user!.id,
      topics: [topic!.id],
      heroImage: hero!.id,
      meta: { description: "desc" },
    })
    expect(payload.db.volumes![0]).toMatchObject({ volumeNumber: 49, articles: [created!.id] })
  })

  it("gives cloned authors a writer role and a password nobody knows", async () => {
    vi.stubGlobal(
      "fetch",
      fakeProduction({ articles: [article({ id: 1, slug: "a", authors: [author(10, "jane")] })] }),
    )
    const payload = fakePayload()

    await cloneArticleFromProduction(payload as never, "a")

    const [user] = payload.db.users!
    expect(user).toMatchObject({ slug: "jane", roles: ["writer"], email: "jane@example.com" })
    expect(user!.password).toEqual(expect.any(String))
    expect((user!.password as string).length).toBeGreaterThanOrEqual(32)
  })

  it("makes a cloned narrator a narrator, and skips local users who can't fill the role", async () => {
    const source = article({
      id: 1,
      slug: "a",
      authors: [author(10, "jane"), author(11, "admin-here")],
      narration: { id: 30, url: "https://cdn.example.com/a.mp3", narrator: author(12, "reader") },
    })
    vi.stubGlobal("fetch", fakeProduction({ articles: [source] }))
    const payload = fakePayload({ users: [{ id: 1, slug: "admin-here", roles: ["admin"] }] })

    await cloneArticleFromProduction(payload as never, "a")

    const user = (slug: string) => payload.db.users!.find((u) => u.slug === slug)!
    expect(payload.db.articles![0]!.authors).toEqual([user("jane").id])
    expect(user("reader").roles).toEqual(["writer", "narrator"])
    expect(user("admin-here").roles).toEqual(["admin"])
    const narration = payload.db.media!.find((m) => m.url === "https://cdn.example.com/a.mp3")
    expect(narration).toMatchObject({ narrator: user("reader").id })
  })

  it("gives blocks fresh IDs, keeping footnote references pointed at each other", async () => {
    const footnote = (id: string, extra: object = {}) => ({
      type: "inlineBlock",
      fields: { id, blockType: "footnote", note: "n", ...extra },
    })
    const source = article({
      id: 1,
      slug: "a",
      content: richText(paragraph(footnote("prod-1"), footnote("prod-2", { sourceId: "prod-1" }))),
    })
    vi.stubGlobal("fetch", fakeProduction({ articles: [source] }))
    const payload = fakePayload()

    await cloneArticleFromProduction(payload as never, "a")

    const content = payload.db.articles![0]!.content as {
      root: { children: [{ children: [{ fields: Row }, { fields: Row }] }] }
    }
    const [first, second] = content.root.children[0].children
    expect(first.fields.id).toMatch(/^[0-9a-f]{24}$/)
    expect(first.fields.id).not.toBe("prod-1")
    expect(second.fields.sourceId).toBe(first.fields.id)
  })

  it("increments the slug when the article is already here", async () => {
    vi.stubGlobal("fetch", fakeProduction({ articles: [article({ id: 1, slug: "housing" })] }))
    const payload = fakePayload({
      articles: [
        { id: 1, slug: "housing" },
        { id: 2, slug: "housing-1" },
      ],
    })

    const result = await cloneArticleFromProduction(payload as never, "housing")

    expect(result.slug).toBe("housing-2")
  })

  it("reuses authors, topics and volumes that already exist here", async () => {
    const source = article({
      id: 1,
      slug: "a",
      authors: [author(10, "jane")],
      topics: [{ id: 7, name: "Housing", slug: "prod-housing", meta: {} }],
    })
    vi.stubGlobal(
      "fetch",
      fakeProduction({
        articles: [source],
        volumes: [{ id: 55, volumeNumber: 49, slug: "49-prod", articles: [1] }],
      }),
    )
    const payload = fakePayload({
      users: [{ id: 1, slug: "jane", roles: ["writer"] }],
      topics: [{ id: 2, name: "Housing", slug: "local-housing" }],
      volumes: [{ id: 3, volumeNumber: 49, slug: "49", articles: [77] }],
    })

    const result = await cloneArticleFromProduction(payload as never, "a")

    expect(result.created).toEqual({ articles: 1 })
    expect(payload.db.articles![0]).toMatchObject({ authors: [1], topics: [2] })
    expect(payload.db.volumes![0]!.articles).toEqual([77, result.id])
  })

  it("points rich-text references at local copies", async () => {
    const svgAsset = {
      id: 3,
      label: "MO districts",
      filename: "mo.svg",
      mimeType: "image/svg+xml",
      svgContent: "<svg/>",
      source: { type: "custom", url: "https://census.gov" },
    }
    const source = article({
      id: 1,
      slug: "a",
      content: richText(
        block({ blockType: "mediaBlock", media: image(20) }),
        block({ blockType: "mediaCollage", images: [{ id: "row", media: image(21) }] }),
        block({ blockType: "timeline", events: [{ title: "e", avatar: image(22) }] }),
        block({ blockType: "interactiveMap", maps: [{ title: "m", svgAsset }] }),
        paragraph(text("see "), {
          type: "inlineBlock",
          fields: {
            blockType: "footnote",
            note: "n",
            link: {
              type: "reference",
              reference: { relationTo: "topics", value: { id: 7, name: "T", slug: "t" } },
            },
          },
        }),
      ),
    })
    vi.stubGlobal("fetch", fakeProduction({ articles: [source] }))
    const payload = fakePayload()

    await cloneArticleFromProduction(payload as never, "a")

    const localMedia = (n: number) =>
      payload.db.media!.find((m) => m.url === `https://cdn.example.com/img-${n}.webp`)!.id
    const [mediaBlock, collage, timeline, map, para] = (
      payload.db.articles![0]!.content as { root: { children: Record<string, never>[] } }
    ).root.children as unknown as Array<{ fields: Record<string, never>; children: never[] }>

    expect(mediaBlock!.fields).toMatchObject({ media: localMedia(20) })
    expect(collage!.fields).toMatchObject({ images: [{ media: localMedia(21) }] })
    expect(timeline!.fields).toMatchObject({ events: [{ avatar: localMedia(22) }] })
    const [asset] = payload.db["map-assets"]!
    expect(map!.fields).toMatchObject({ maps: [{ svgAsset: asset!.id }] })
    expect(asset).toMatchObject({ label: "MO districts", source: { url: "https://census.gov" } })
    expect(para!.children[1]).toMatchObject({
      fields: { link: { reference: { relationTo: "topics", value: payload.db.topics![0]!.id } } },
    })
  })

  it("clones a linked article one level deep and links past that to production", async () => {
    const third = article({ id: 3, slug: "third" })
    const second = article({
      id: 2,
      slug: "second",
      content: richText(paragraph(internalLink("articles", third))),
    })
    const first = article({
      id: 1,
      slug: "first",
      content: richText(
        paragraph(
          internalLink("articles", second),
          internalLink("pages", { id: 9, slug: "about" }),
        ),
      ),
    })
    vi.stubGlobal("fetch", fakeProduction({ articles: [first, second, third] }))
    const payload = fakePayload()

    const result = await cloneArticleFromProduction(payload as never, "first")

    expect(result.created).toEqual({ articles: 2 })
    const bySlug = (slug: string) => payload.db.articles!.find((a) => a.slug === slug)!
    const links = (slug: string) =>
      (bySlug(slug).content as { root: { children: [{ children: { fields: object }[] }] } }).root
        .children[0].children
    const [toSecond, toAbout] = links("first")
    expect(toSecond!.fields).toMatchObject({
      linkType: "internal",
      doc: { relationTo: "articles", value: bySlug("second").id },
    })
    expect(toAbout!.fields).toMatchObject({ linkType: "custom", url: `${PROD}/about`, doc: null })
    expect(links("second")[0]!.fields).toMatchObject({
      linkType: "custom",
      url: `${PROD}/articles/third`,
    })
  })

  it("fetches references production returned only as IDs", async () => {
    const source = article({ id: 1, slug: "a", heroImage: 20 })
    vi.stubGlobal("fetch", fakeProduction({ articles: [source], docs: { "media/20": image(20) } }))
    const payload = fakePayload()

    await cloneArticleFromProduction(payload as never, "a")

    expect(payload.db.articles![0]!.heroImage).toBe(payload.db.media![0]!.id)
  })

  it("falls back to a resized copy, and skips media with nothing reachable", async () => {
    const source = article({
      id: 1,
      slug: "a",
      heroImage: image(20),
      narration: { id: 30, url: "https://cdn.example.com/gone.mp3" },
    })
    vi.stubGlobal(
      "fetch",
      fakeProduction({
        articles: [source],
        unreachable: ["https://cdn.example.com/img-20.webp", "https://cdn.example.com/gone.mp3"],
      }),
    )
    const payload = fakePayload()

    await cloneArticleFromProduction(payload as never, "a")

    expect(payload.db.media).toEqual([
      expect.objectContaining({ url: "https://cdn.example.com/large-img-20.webp" }),
    ])
    expect(payload.db.articles![0]).toMatchObject({ narration: null })
  })

  it("downloads a map's SVG when production didn't inline it, and drops a map it can't reach", async () => {
    const mapAsset = (id: number, name: string) => ({
      id,
      label: name,
      filename: `${name}.svg`,
      mimeType: "image/svg+xml",
      url: `https://cdn.example.com/${name}.svg`,
    })
    const source = article({
      id: 1,
      slug: "a",
      content: richText(
        block({
          blockType: "interactiveMap",
          maps: [{ svgAsset: mapAsset(3, "mo") }, { svgAsset: mapAsset(4, "gone") }],
        }),
      ),
    })
    const production = fakeProduction({
      articles: [source],
      unreachable: ["https://cdn.example.com/gone.svg"],
    })
    vi.stubGlobal("fetch", async (input: string | URL, init?: RequestInit) =>
      String(input) === "https://cdn.example.com/mo.svg" && init?.method !== "HEAD"
        ? new Response("<svg>mo</svg>")
        : production(input, init),
    )
    const payload = fakePayload()

    await cloneArticleFromProduction(payload as never, "a")

    const [asset] = payload.db["map-assets"]!
    const [map] = (payload.db.articles![0]!.content as { root: { children: Row[] } }).root.children
    expect(payload.db["map-assets"]).toHaveLength(1)
    expect(map!.fields).toMatchObject({ maps: [{ svgAsset: asset!.id }, { svgAsset: null }] })
    const { file } = payload.create.mock.calls.find(([c]) => c.collection === "map-assets")![0]
    expect(file.data.toString()).toBe("<svg>mo</svg>")
    expect(file.name).toMatch(/-mo\.svg$/)
  })

  it("keeps uploads it could clone, drops the rest, and sends other references to production", async () => {
    const source = article({
      id: 1,
      slug: "a",
      content: richText(
        { type: "upload", version: 3, relationTo: "media", value: image(20), fields: null },
        { type: "upload", version: 3, relationTo: "media", value: image(21), fields: null },
        paragraph({
          type: "inlineBlock",
          fields: {
            blockType: "footnote",
            link: {
              type: "reference",
              reference: { relationTo: "pages", value: { id: 9, slug: "about" } },
            },
          },
        }),
      ),
    })
    vi.stubGlobal(
      "fetch",
      fakeProduction({
        articles: [source],
        unreachable: [
          "https://cdn.example.com/img-21.webp",
          "https://cdn.example.com/large-img-21.webp",
        ],
      }),
    )
    const payload = fakePayload()

    await cloneArticleFromProduction(payload as never, "a")

    const children = (payload.db.articles![0]!.content as { root: { children: Row[] } }).root
      .children as unknown as Array<Row & { children?: Row[] }>
    expect(children).toHaveLength(2)
    expect(children[0]).toMatchObject({
      type: "upload",
      relationTo: "media",
      value: payload.db.media![0]!.id,
    })
    expect(children[1]!.children![0]).toMatchObject({
      fields: { link: { type: "custom", url: `${PROD}/about`, reference: null } },
    })
  })

  it("clones an article that links to itself only once", async () => {
    const source = article({ id: 1, slug: "a" })
    source.content = richText(paragraph(internalLink("articles", { id: 1, slug: "a" })))
    vi.stubGlobal("fetch", fakeProduction({ articles: [source] }))
    const payload = fakePayload()

    const result = await cloneArticleFromProduction(payload as never, "a")

    expect(result.created).toEqual({ articles: 1 })
    expect(payload.db.articles).toHaveLength(1)
  })

  it("clones the article without a reference that fails, and logs why", async () => {
    const source = article({
      id: 1,
      slug: "a",
      topics: [{ id: 7, name: "Housing", slug: "housing", description: null, meta: {} }],
    })
    vi.stubGlobal("fetch", fakeProduction({ articles: [source] }))
    const payload = fakePayload()
    const create = payload.create.getMockImplementation()!
    payload.create.mockImplementation(async (args) => {
      if (args.collection === "topics") throw new Error("name must be unique")
      return create(args)
    })

    await cloneArticleFromProduction(payload as never, "a")

    expect(payload.db.articles![0]).toMatchObject({ slug: "a", topics: [] })
    expect(payload.logger.warn).toHaveBeenCalledWith(
      { err: expect.objectContaining({ message: "name must be unique" }) },
      "[clone] Could not clone topics:7 from production",
    )
  })

  it("transfers media a few files at a time and reports running totals", async () => {
    const images = [20, 21, 22, 23, 24, 25, 26].map((id) => image(id))
    const source = article({
      id: 1,
      slug: "a",
      authors: [author(10, "jane")],
      content: richText(...images.map((media) => block({ blockType: "mediaBlock", media }))),
    })
    vi.stubGlobal("fetch", fakeProduction({ articles: [source] }))
    const payload = fakePayload()
    let active = 0
    let peak = 0
    const create = vi.mocked(createMediaFromURL).getMockImplementation()!
    vi.mocked(createMediaFromURL).mockImplementation(async (...args) => {
      peak = Math.max(peak, ++active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active--
      return create(...args)
    })
    const progress: object[] = []

    const result = await cloneArticleFromProduction(payload as never, "a", {
      onProgress: (created) => progress.push(created),
    })
    vi.mocked(createMediaFromURL).mockImplementation(create)

    // Seven content images and the author's profile photo, no more than four at once.
    expect(payload.db.media).toHaveLength(8)
    expect(peak).toBe(4)
    expect(progress).toHaveLength(10)
    expect(progress.at(-1)).toEqual(result.created)
    expect(result.created).toEqual({ media: 8, users: 1, articles: 1 })
  })

  it("clones media referenced in several places at once only once", async () => {
    const shared = image(20)
    const source = article({
      id: 1,
      slug: "a",
      heroImage: shared,
      meta: { image: shared },
      content: richText(
        block({ blockType: "mediaBlock", media: shared }),
        block({ blockType: "mediaCollage", images: [{ id: "row", media: shared }] }),
      ),
    })
    vi.stubGlobal("fetch", fakeProduction({ articles: [source] }))
    const payload = fakePayload()

    await cloneArticleFromProduction(payload as never, "a")

    expect(payload.db.media).toHaveLength(1)
    expect(payload.db.articles![0]).toMatchObject({
      heroImage: payload.db.media![0]!.id,
      meta: { image: payload.db.media![0]!.id },
    })
  })

  it("keeps the cloned article when its volume refuses it", async () => {
    const source = article({ id: 1, slug: "a" })
    const volume = { id: 40, volumeNumber: 4, title: "Vol 4", slug: "4", articles: [1] }
    vi.stubGlobal("fetch", fakeProduction({ articles: [source], volumes: [volume] }))
    const payload = fakePayload()
    payload.update.mockRejectedValueOnce(new Error("The following articles are not published"))

    const result = await cloneArticleFromProduction(payload as never, "a")

    expect(result).toMatchObject({ slug: "a", created: { articles: 1, volumes: 1 } })
    expect(payload.logger.warn).toHaveBeenCalledWith(
      { err: expect.objectContaining({ message: "The following articles are not published" }) },
      "[clone] Could not add a to its volume",
    )
  })

  it("throws ArticleNotFoundError for a slug production doesn't have", async () => {
    vi.stubGlobal("fetch", fakeProduction({}))

    await expect(cloneArticleFromProduction(fakePayload() as never, "nope")).rejects.toThrow(
      ArticleNotFoundError,
    )
  })
})

describe("productionUrl", () => {
  it.each([
    ["articles", { slug: "a" }, `${PROD}/articles/a`],
    ["volumes", { slug: "49" }, `${PROD}/volumes/49`],
    ["users", { slug: "jane" }, `${PROD}/authors/jane`],
    ["pages", { slug: "about" }, `${PROD}/about`],
    ["pages", { slug: "home" }, `${PROD}/`],
    ["articles", 12, PROD],
  ])("%s %j → %s", (collection, doc, expected) => {
    expect(productionUrl(collection, doc)).toBe(expected)
  })
})
