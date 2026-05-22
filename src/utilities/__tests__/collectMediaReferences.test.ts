import type { Payload } from "payload"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { collectMediaReferences } from "../collectMediaReferences"

function createMockPayload(
  responses: Record<string, { docs: Record<string, unknown>[] }>,
): Payload {
  return {
    find: vi.fn((args: { collection: string }) => {
      const key = args.collection
      if (key in responses) return Promise.resolve(responses[key])
      return Promise.resolve({
        docs: [],
        totalDocs: 0,
        limit: 10,
        page: 1,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      })
    }),
  } as unknown as Payload
}

describe("collectMediaReferences", () => {
  let payload: Payload

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("articles", () => {
    it("finds references in heroImage", async () => {
      payload = createMockPayload({
        articles: {
          docs: [{ id: 1, title: "Test Article", slug: "test-article", heroImage: 42 }],
        },
      })
      const refs = await collectMediaReferences(payload, 42)

      expect(refs).toContainEqual({
        collection: "articles",
        field: "heroImage",
        docId: 1,
        docTitle: "Test Article",
        docSlug: "test-article",
      })
    })

    it("finds references in narration", async () => {
      payload = createMockPayload({
        articles: {
          docs: [{ id: 1, title: "Audio Article", slug: "audio-article", narration: 42 }],
        },
      })
      const refs = await collectMediaReferences(payload, 42)

      expect(refs).toContainEqual({
        collection: "articles",
        field: "narration",
        docId: 1,
        docTitle: "Audio Article",
        docSlug: "audio-article",
      })
    })

    it("finds references in meta.image", async () => {
      payload = createMockPayload({
        articles: {
          docs: [{ id: 1, title: "Meta Article", slug: "meta-article", meta: { image: 42 } }],
        },
      })
      const refs = await collectMediaReferences(payload, 42)

      expect(refs).toContainEqual({
        collection: "articles",
        field: "meta.image",
        docId: 1,
        docTitle: "Meta Article",
        docSlug: "meta-article",
      })
    })

    it("finds multiple field references in a single article", async () => {
      payload = createMockPayload({
        articles: {
          docs: [{ id: 1, title: "Multi Article", slug: "multi", heroImage: 42, narration: 42 }],
        },
      })
      const refs = await collectMediaReferences(payload, 42)

      expect(refs).toContainEqual({
        collection: "articles",
        field: "heroImage",
        docId: 1,
        docTitle: "Multi Article",
        docSlug: "multi",
      })
      expect(refs).toContainEqual({
        collection: "articles",
        field: "narration",
        docId: 1,
        docTitle: "Multi Article",
        docSlug: "multi",
      })
    })

    it("finds references in Lexical content (mediaBlock)", async () => {
      payload = createMockPayload({
        articles: {
          docs: [
            {
              id: 1,
              title: "Content Article",
              slug: "content-article",
              content: {
                root: {
                  children: [{ type: "block", fields: { blockType: "mediaBlock", media: 42 } }],
                },
              },
            },
          ],
        },
      })
      const refs = await collectMediaReferences(payload, 42)

      expect(refs).toContainEqual({
        collection: "articles",
        field: "content (mediaBlock)",
        docId: 1,
        docTitle: "Content Article",
        docSlug: "content-article",
      })
    })

    it("uses 'Untitled' when title is missing", async () => {
      payload = createMockPayload({
        articles: {
          docs: [{ id: 1, title: null, slug: "no-title", heroImage: 42 }],
        },
      })
      const refs = await collectMediaReferences(payload, 42)

      expect(refs).toContainEqual(expect.objectContaining({ docTitle: "Untitled" }))
    })

    it("matches mediaId as number or string", async () => {
      payload = createMockPayload({
        articles: {
          docs: [{ id: 1, title: "Article", slug: "a", heroImage: "42" }],
        },
      })
      const refs = await collectMediaReferences(payload, 42)

      expect(refs).toContainEqual(expect.objectContaining({ field: "heroImage" }))
    })
  })

  describe("pages", () => {
    it("finds references in hero.media", async () => {
      payload = createMockPayload({
        pages: {
          docs: [{ id: 10, title: "Home", slug: "home", hero: { media: 42 } }],
        },
      })
      const refs = await collectMediaReferences(payload, 42)

      expect(refs).toContainEqual({
        collection: "pages",
        field: "hero.media",
        docId: 10,
        docTitle: "Home",
        docSlug: "home",
      })
    })

    it("finds references in meta.image", async () => {
      payload = createMockPayload({
        pages: {
          docs: [{ id: 10, title: "About", slug: "about", meta: { image: 42 } }],
        },
      })
      const refs = await collectMediaReferences(payload, 42)

      expect(refs).toContainEqual({
        collection: "pages",
        field: "meta.image",
        docId: 10,
        docTitle: "About",
        docSlug: "about",
      })
    })

    it("finds references in layout mediaBlock", async () => {
      payload = createMockPayload({
        pages: {
          docs: [
            {
              id: 10,
              title: "Layout Page",
              slug: "layout-page",
              layout: [{ blockType: "mediaBlock", media: 42 }],
            },
          ],
        },
      })
      const refs = await collectMediaReferences(payload, 42)

      expect(refs).toContainEqual({
        collection: "pages",
        field: "layout (mediaBlock)",
        docId: 10,
        docTitle: "Layout Page",
        docSlug: "layout-page",
      })
    })

    it("skips layout blocks that are not mediaBlocks", async () => {
      payload = createMockPayload({
        pages: {
          docs: [
            {
              id: 10,
              title: "No Media Page",
              slug: "no-media",
              layout: [{ blockType: "content", someField: 42 }],
            },
          ],
        },
      })
      const refs = await collectMediaReferences(payload, 42)

      const pageRefs = refs.filter((r) => r.collection === "pages")
      expect(pageRefs).toEqual([])
    })
  })

  describe("volumes", () => {
    it("finds references in meta.image", async () => {
      payload = createMockPayload({
        volumes: {
          docs: [{ id: 5, title: "Vol 1", slug: "vol-1", meta: { image: 42 } }],
        },
      })
      const refs = await collectMediaReferences(payload, 42)

      expect(refs).toContainEqual({
        collection: "volumes",
        field: "meta.image",
        docId: 5,
        docTitle: "Vol 1",
        docSlug: "vol-1",
      })
    })

    it("finds references in editorsNote Lexical content", async () => {
      payload = createMockPayload({
        volumes: {
          docs: [
            {
              id: 5,
              title: "Vol 2",
              slug: "vol-2",
              editorsNote: {
                root: {
                  children: [{ type: "block", fields: { blockType: "mediaBlock", media: 42 } }],
                },
              },
            },
          ],
        },
      })
      const refs = await collectMediaReferences(payload, 42)

      expect(refs).toContainEqual({
        collection: "volumes",
        field: "editorsNote (mediaBlock)",
        docId: 5,
        docTitle: "Vol 2",
        docSlug: "vol-2",
      })
    })
  })

  describe("topics", () => {
    it("finds references in meta.image", async () => {
      payload = createMockPayload({
        topics: {
          docs: [{ id: 3, name: "Philosophy", slug: "philosophy", meta: { image: 42 } }],
        },
      })
      const refs = await collectMediaReferences(payload, 42)

      expect(refs).toContainEqual({
        collection: "topics",
        field: "meta.image",
        docId: 3,
        docTitle: "Philosophy",
        docSlug: "philosophy",
      })
    })

    it("uses 'Untitled' when name is missing", async () => {
      payload = createMockPayload({
        topics: {
          docs: [{ id: 3, name: null, slug: "no-name", meta: { image: 42 } }],
        },
      })
      const refs = await collectMediaReferences(payload, 42)

      expect(refs).toContainEqual(expect.objectContaining({ docTitle: "Untitled" }))
    })
  })

  describe("users", () => {
    it("finds references in profileImage", async () => {
      payload = createMockPayload({
        users: {
          docs: [{ id: 7, name: "Jane Doe", profileImage: 42 }],
        },
      })
      const refs = await collectMediaReferences(payload, 42)

      expect(refs).toContainEqual({
        collection: "users",
        field: "profileImage",
        docId: 7,
        docTitle: "Jane Doe",
      })
    })

    it("uses 'Unknown user' when name is missing", async () => {
      payload = createMockPayload({
        users: {
          docs: [{ id: 7, name: null, profileImage: 42 }],
        },
      })
      const refs = await collectMediaReferences(payload, 42)

      expect(refs).toContainEqual(expect.objectContaining({ docTitle: "Unknown user" }))
    })

    it("does not include docSlug for users", async () => {
      payload = createMockPayload({
        users: {
          docs: [{ id: 7, name: "Jane", profileImage: 42 }],
        },
      })
      const refs = await collectMediaReferences(payload, 42)
      const userRef = refs.find((r) => r.collection === "users")

      expect(userRef?.docSlug).toBeUndefined()
    })
  })

  describe("when no references exist", () => {
    it("returns an empty array", async () => {
      payload = createMockPayload({})
      const refs = await collectMediaReferences(payload, 999)

      expect(refs).toEqual([])
    })
  })

  describe("query construction", () => {
    it("queries articles for published status and media fields", async () => {
      const mockFind = vi.fn().mockResolvedValue({
        docs: [],
        totalDocs: 0,
        limit: 10,
        page: 1,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      })
      payload = { find: mockFind } as unknown as Payload

      await collectMediaReferences(payload, 42)

      const calls = mockFind.mock.calls as Array<[args: Record<string, unknown>]>
      const articlesCall = calls.find((call) => call[0].collection === "articles")
      expect(articlesCall).toBeDefined()
      expect(articlesCall![0]).toEqual(
        expect.objectContaining({
          collection: "articles",
          depth: 0,
          overrideAccess: true,
        }),
      )
      expect(articlesCall![0].where).toEqual({
        and: [
          { _status: { equals: "published" } },
          {
            or: [
              { heroImage: { equals: 42 } },
              { narration: { equals: 42 } },
              { "meta.image": { equals: 42 } },
            ],
          },
        ],
      })
    })

    it("queries users without published status filter", async () => {
      const mockFind = vi.fn().mockResolvedValue({
        docs: [],
        totalDocs: 0,
        limit: 10,
        page: 1,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      })
      payload = { find: mockFind } as unknown as Payload

      await collectMediaReferences(payload, 42)

      const calls = mockFind.mock.calls as Array<[args: Record<string, unknown>]>
      const usersCall = calls.find((call) => call[0].collection === "users")
      expect(usersCall).toBeDefined()
      expect(usersCall![0].where).toEqual({
        profileImage: { equals: 42 },
      })
    })
  })
})
