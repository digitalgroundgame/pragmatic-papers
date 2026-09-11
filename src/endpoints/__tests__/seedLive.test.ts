import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Payload } from "payload"
import type { Media } from "@/payload-types"
import { seedLive } from "../seedLive"
import { createMediaFromURL } from "@/endpoints/seed/media"

vi.mock("@/endpoints/seed/media", () => ({
  createMediaFromURL: vi.fn(),
}))

const mockFind = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()

const mockPayload = {
  find: mockFind,
  create: mockCreate,
  update: mockUpdate,
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
} as unknown as Payload

const globalFetch = global.fetch

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = globalFetch
})

describe("seedLive", () => {
  it("fetches articles and creates them when they do not exist", async () => {
    const mockArticles = [
      {
        title: "Test Article",
        slug: "test-article",
        content: { root: { type: "root", children: [] } },
        populatedAuthors: [
          {
            name: "John Doe",
            slug: "john-doe",
          },
        ],
        topics: [
          {
            name: "Politics",
            slug: "politics",
          },
        ],
        heroImage: {
          url: "https://example.com/image.png",
          alt: "Test Image",
        },
        populatedVolume: {
          title: "Volume 1",
          volumeNumber: 1,
        },
      },
    ]

    global.fetch = vi.fn().mockImplementation(async (url, options) => {
      if (options?.method === "HEAD") {
        return { status: 200, ok: true } as Response
      }
      return {
        ok: true,
        json: async () => ({ docs: mockArticles }),
      } as Response
    })

    mockFind.mockImplementation(async ({ collection }) => {
      if (collection === "articles") {
        return { docs: [] }
      }
      if (collection === "users") {
        return { docs: [] }
      }
      if (collection === "topics") {
        return { docs: [] }
      }
      if (collection === "volumes") {
        return { docs: [] }
      }
      if (collection === "media") {
        return { docs: [] }
      }
      return { docs: [] }
    })

    vi.mocked(createMediaFromURL).mockResolvedValue({ id: 99 } as unknown as Media)

    mockCreate.mockImplementation(async ({ collection }) => {
      if (collection === "users") {
        return { id: 10, name: "John Doe" }
      }
      if (collection === "topics") {
        return { id: 20, name: "Politics" }
      }
      if (collection === "articles") {
        return { id: 30, title: "Test Article" }
      }
      if (collection === "volumes") {
        return { id: 40, title: "Volume 1" }
      }
      return {}
    })

    const progressTracker = vi.fn()

    await seedLive(mockPayload, progressTracker)

    expect(global.fetch).toHaveBeenCalledWith(
      "https://pragmaticpapers.com/api/articles",
      expect.any(Object),
    )
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "users",
        data: expect.objectContaining({
          slug: "john-doe",
          name: "John Doe",
        }),
      }),
    )
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "topics",
        data: expect.objectContaining({
          slug: "politics",
          name: "Politics",
        }),
      }),
    )
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "articles",
        data: expect.objectContaining({
          slug: "test-article",
          title: "Test Article",
          authors: [10],
          topics: [20],
          heroImage: 99,
        }),
      }),
    )
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "volumes",
        data: expect.objectContaining({
          volumeNumber: 1,
          articles: [30],
        }),
      }),
    )
    expect(progressTracker).toHaveBeenCalledWith(
      expect.stringContaining("Import finished successfully!"),
      expect.any(Number),
      expect.any(Number),
    )
  })
})
