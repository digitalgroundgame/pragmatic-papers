import type { Payload, PayloadRequest, Where } from "payload"
import { describe, expect, it, vi } from "vitest"
import {
  collectMediaReferences,
  indexMediaReferences,
  mediaReferencesInRequest,
} from "../collectMediaReferences"

type Doc = Record<string, unknown>

interface FindArgs {
  collection: string
  page: number
  limit: number
  where: Where
}

/** Serves each collection's docs in pages, as `payload.find` does. Filtering is the test's job. */
function fakePayload(docs: Record<string, Doc[]>): Payload & { find: ReturnType<typeof vi.fn> } {
  return {
    find: vi.fn(async ({ collection, page, limit }: FindArgs) => {
      const all = docs[collection] ?? []
      return {
        docs: all.slice((page - 1) * limit, page * limit),
        hasNextPage: page * limit < all.length,
      }
    }),
  } as unknown as Payload & { find: ReturnType<typeof vi.fn> }
}

const mediaBlockContent = (media: unknown): Doc => ({
  root: { type: "root", children: [{ type: "block", fields: { blockType: "mediaBlock", media } }] },
})

describe("collectMediaReferences", () => {
  it("finds an article's upload fields", async () => {
    const payload = fakePayload({
      articles: [
        { id: 1, title: "Hero", slug: "hero", heroImage: 42 },
        { id: 2, title: "Narrated", slug: "narrated", narration: 42 },
        { id: 3, title: "Shared", slug: "shared", meta: { image: 42 } },
        { id: 4, title: "Unrelated", slug: "unrelated", heroImage: 7 },
      ],
    })

    expect(await collectMediaReferences(payload, 42)).toEqual([
      { collection: "articles", field: "heroImage", docId: 1, docTitle: "Hero", docSlug: "hero" },
      {
        collection: "articles",
        field: "narration",
        docId: 2,
        docTitle: "Narrated",
        docSlug: "narrated",
      },
      {
        collection: "articles",
        field: "meta.image",
        docId: 3,
        docTitle: "Shared",
        docSlug: "shared",
      },
    ])
  })

  it("finds media blocks in an article's content", async () => {
    const payload = fakePayload({
      articles: [{ id: 1, title: "Body", slug: "body", content: mediaBlockContent(42) }],
    })

    expect(await collectMediaReferences(payload, 42)).toEqual([
      {
        collection: "articles",
        field: "content (mediaBlock)",
        docId: 1,
        docTitle: "Body",
        docSlug: "body",
      },
    ])
  })

  it("finds a page's hero and layout blocks, timeline avatars included", async () => {
    const payload = fakePayload({
      pages: [
        {
          id: 5,
          title: "Home",
          slug: "home",
          hero: { media: 42 },
          layout: [{ blockType: "timeline", events: [{ avatar: 42 }] }],
        },
      ],
    })

    const refs = await collectMediaReferences(payload, 42)
    expect(refs.map((ref) => ref.field)).toEqual(["hero.media", "layout (timeline)"])
  })

  it("finds media in a volume's editor's note and the other collections", async () => {
    const payload = fakePayload({
      volumes: [{ id: 1, title: "Vol I", slug: "1", editorsNote: mediaBlockContent(42) }],
      interactives: [{ id: 2, title: "Courts", slug: "courts", meta: { image: 42 } }],
      topics: [{ id: 3, name: "Economy", slug: "economy", meta: { image: 42 } }],
      users: [{ id: 4, name: "Ada", profileImage: 42 }],
    })

    expect(await collectMediaReferences(payload, 42)).toEqual([
      {
        collection: "volumes",
        field: "editorsNote (mediaBlock)",
        docId: 1,
        docTitle: "Vol I",
        docSlug: "1",
      },
      {
        collection: "interactives",
        field: "meta.image",
        docId: 2,
        docTitle: "Courts",
        docSlug: "courts",
      },
      {
        collection: "topics",
        field: "meta.image",
        docId: 3,
        docTitle: "Economy",
        docSlug: "economy",
      },
      { collection: "users", field: "profileImage", docId: 4, docTitle: "Ada", docSlug: undefined },
    ])
  })

  it("reads every page of results", async () => {
    const articles = Array.from({ length: 250 }, (_, i) => ({ id: i + 1, title: `A${i + 1}` }))
    articles[249] = { ...articles[249], content: mediaBlockContent(42) } as Doc &
      (typeof articles)[number]
    const payload = fakePayload({ articles })

    const refs = await collectMediaReferences(payload, 42)

    expect(refs.map((ref) => ref.docId)).toEqual([250])
    const calls = payload.find.mock.calls as [FindArgs][]
    const articlePages = calls.filter(([args]) => args.collection === "articles")
    expect(articlePages).toHaveLength(3)
  })

  it("reads only published documents in collections with drafts", async () => {
    const payload = fakePayload({})
    await collectMediaReferences(payload, 42)

    const calls = payload.find.mock.calls as [FindArgs][]
    const whereFor = (collection: string): Where | undefined =>
      calls.find(([args]) => args.collection === collection)?.[0].where

    expect(whereFor("articles")).toEqual({ _status: { equals: "published" } })
    expect(whereFor("interactives")).toEqual({ _status: { equals: "published" } })
    expect(whereFor("topics")).toBeUndefined()
    expect(whereFor("users")).toBeUndefined()
  })

  it("falls back to 'Untitled' for a document without a title", async () => {
    const payload = fakePayload({ articles: [{ id: 1, heroImage: 42 }] })
    const [ref] = await collectMediaReferences(payload, 42)
    expect(ref?.docTitle).toBe("Untitled")
  })
})

describe("indexMediaReferences", () => {
  it("indexes every media id published content uses", async () => {
    const payload = fakePayload({
      articles: [
        {
          id: 1,
          title: "Both",
          slug: "both",
          heroImage: 42,
          content: mediaBlockContent({ id: 7 }),
        },
      ],
      users: [{ id: 4, name: "Ada", profileImage: 42 }],
    })

    const index = await indexMediaReferences(payload)

    expect([...index.keys()].sort()).toEqual(["42", "7"])
    expect(index.get("42")?.map((ref) => `${ref.collection}/${ref.field}`)).toEqual([
      "articles/heroImage",
      "users/profileImage",
    ])
    expect(index.get("7")?.map((ref) => ref.field)).toEqual(["content (mediaBlock)"])
  })

  it("skips empty upload fields", async () => {
    const payload = fakePayload({
      articles: [{ id: 1, title: "Bare", heroImage: null, meta: { image: undefined } }],
    })

    expect((await indexMediaReferences(payload)).size).toBe(0)
  })
})

describe("mediaReferencesInRequest", () => {
  const requestFor = (payload: Payload) => ({ payload, context: {} }) as unknown as PayloadRequest

  it("reads published content once for every lookup in a request", async () => {
    const payload = fakePayload({
      articles: [
        { id: 1, title: "One", heroImage: 42 },
        { id: 2, title: "Two", heroImage: 7 },
      ],
    })
    const req = requestFor(payload)

    const first = await mediaReferencesInRequest(req, 42)
    const callsAfterFirst = payload.find.mock.calls.length
    const second = await mediaReferencesInRequest(req, "7")
    const unused = await mediaReferencesInRequest(req, 99)

    expect(first.map((ref) => ref.docId)).toEqual([1])
    expect(second.map((ref) => ref.docId)).toEqual([2])
    expect(unused).toEqual([])
    expect(payload.find).toHaveBeenCalledTimes(callsAfterFirst)
  })

  it("reads again for a new request, even one given the same context", async () => {
    const payload = fakePayload({ articles: [{ id: 1, title: "One", heroImage: 42 }] })
    const context = {}

    await mediaReferencesInRequest({ payload, context } as unknown as PayloadRequest, 42)
    const callsForOneRequest = payload.find.mock.calls.length
    await mediaReferencesInRequest({ payload, context } as unknown as PayloadRequest, 42)

    expect(payload.find).toHaveBeenCalledTimes(callsForOneRequest * 2)
  })

  it("shares the read between lookups that start together", async () => {
    const payload = fakePayload({ articles: [{ id: 1, title: "One", heroImage: 42 }] })
    const req = requestFor(payload)

    await Promise.all([mediaReferencesInRequest(req, 42), mediaReferencesInRequest(req, 7)])
    const callsForBoth = payload.find.mock.calls.length
    await mediaReferencesInRequest(requestFor(payload), 42)

    expect(payload.find.mock.calls.length).toBe(callsForBoth * 2)
  })
})
