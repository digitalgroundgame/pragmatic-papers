// @vitest-environment node
import type { Article, Volume } from "@/payload-types"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const find = vi.fn()

vi.mock("@payload-config", () => ({ default: {} }))
vi.mock("payload", () => ({ getPayload: vi.fn(async () => ({ find })) }))

beforeAll(() => {
  process.env.SERVER_URL = "https://example.org"
})

const articlesRoute = await import("../articles/feed.xml/route")
const volumesRoute = await import("../volumes/feed.xml/route")

const published = {
  _status: "published",
  publishedAt: "2026-09-01T12:00:00.000Z",
  updatedAt: "2026-09-01T12:00:00.000Z",
  createdAt: "2026-09-01T12:00:00.000Z",
} as const

afterEach(() => {
  vi.clearAllMocks()
})

describe("GET /articles/feed.xml", () => {
  it("serves the latest published articles as a feed", async () => {
    find.mockResolvedValue({
      docs: [
        { id: 1, title: "One", slug: "one", content: null, ...published } as unknown as Article,
      ],
    })

    const response = await articlesRoute.GET(new Request("https://example.org") as never)
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("application/xml")
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=")
    expect(xml).toMatch(/href="[^"]*\/articles\/one"/)
    expect(xml).toMatch(/href="[^"]*\/articles\/feed\.xml"/)
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "articles", draft: false, overrideAccess: false }),
    )
    expect(articlesRoute.dynamic).toBe("force-static")
  })
})

describe("GET /volumes/feed.xml", () => {
  it("serves the latest published volumes as a feed", async () => {
    find.mockResolvedValue({
      docs: [{ id: 1, title: "Volume One", slug: "1", description: "", ...published } as Volume],
    })

    const response = await volumesRoute.GET(new Request("https://example.org") as never)
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("application/xml")
    expect(xml).toMatch(/href="[^"]*\/volumes\/1"/)
    expect(xml).toMatch(/href="[^"]*\/volumes\/feed\.xml"/)
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "volumes", draft: false, depth: 2 }),
    )
    expect(volumesRoute.dynamic).toBe("force-static")
  })
})
