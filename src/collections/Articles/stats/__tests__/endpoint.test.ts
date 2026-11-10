import type { PayloadRequest } from "payload"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { PageFigures } from "@/integrations/google/analytics"

import {
  type ArticleStats,
  articleStatsEndpoints,
  articleStatsHandler,
  refreshArticleStatsHandler,
} from "../endpoint"
import { articleFiguresCache } from "../figures"

const ga = vi.hoisted(() => ({
  configured: true,
  pageFigures: vi.fn(),
  reportsUrl: vi.fn(() => "https://analytics.example/p1"),
}))

vi.mock("@/integrations", () => ({
  googleAnalytics: { pageFigures: ga.pageFigures, reportsUrl: ga.reportsUrl },
  integrationStatus: () => ({ configured: ga.configured }),
}))

const range = (views: number) => ({ views, readers: 1, readersWhoFinished: 0, eventCount: 0 })
const figures: PageFigures = {
  allTime: range(30),
  last30Days: range(20),
  last7Days: range(10),
  referrers: [],
}

interface Setup {
  user?: { id: number; roles: string[] } | null
  id?: string
  article?: Record<string, unknown> | null
  comments?: boolean
  rankings?: { article: number | { id: number } }[]
  narrator?: number
}

const editor = { id: 1, roles: ["editor"] }
const writer = { id: 2, roles: ["writer"] }

const published = {
  id: 7,
  slug: "a-story",
  publishedAt: "2026-11-01T12:00:00.000Z",
  authors: [2],
  narration: null,
  _status: "published",
}

function request({
  user = editor,
  id = "7",
  article = published,
  comments = true,
  rankings = [],
  narrator,
}: Setup = {}) {
  const counts: Record<string, number> = { published: 4, "auto-hidden": 2, hidden: 1 }
  const payload = {
    config: { routes: { admin: "/admin" } },
    logger: { warn: vi.fn() },
    findByID: vi.fn(async ({ collection }: { collection: string }) =>
      collection === "media" ? { narrator } : article,
    ),
    findGlobal: vi.fn(async ({ slug }: { slug: string }) =>
      slug === "plugins" ? { switches: { comments } } : { rankings },
    ),
    count: vi.fn(async ({ where }: { where: { status: { equals: string } } }) => ({
      totalDocs: counts[where.status.equals] ?? 0,
    })),
  }
  const req = { user, payload, routeParams: { id } } as unknown as PayloadRequest
  return { req, payload }
}

const body = async (response: Response) => (await response.json()) as ArticleStats

beforeEach(() => {
  ga.configured = true
  ga.pageFigures.mockResolvedValue(figures)
})

afterEach(() => {
  articleFiguresCache.clear()
  vi.clearAllMocks()
})

describe("article stats endpoints", () => {
  it("registers GET for the figures and POST to refresh them", () => {
    expect(articleStatsEndpoints.map(({ path, method }) => [method, path])).toEqual([
      ["get", "/:id/stats"],
      ["post", "/:id/stats/refresh"],
    ])
  })

  it("refuses a request with nobody signed in", async () => {
    const response = await articleStatsHandler(request({ user: null }).req)
    expect(response.status).toBe(401)
  })

  it.each(["abc", "0", "-3", "1.5"])("refuses the article id %s", async (id) => {
    const response = await articleStatsHandler(request({ id }).req)
    expect(response.status).toBe(400)
  })

  it("answers 404 for an article that doesn't exist", async () => {
    const response = await articleStatsHandler(request({ article: null }).req)
    expect(response.status).toBe(404)
  })

  it("refuses a writer the article doesn't credit", async () => {
    const user = { id: 3, roles: ["writer"] }
    const response = await articleStatsHandler(request({ user }).req)
    expect(response.status).toBe(403)
  })

  it("has nothing to count on an article that was never published", async () => {
    const { req, payload } = request({ article: { ...published, _status: "draft" } })
    const response = await articleStatsHandler(req)

    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(await body(response)).toEqual({
      published: false,
      narration: false,
      analytics: null,
      comments: null,
      ranking: null,
    })
    expect(ga.pageFigures).not.toHaveBeenCalled()
    expect(payload.count).not.toHaveBeenCalled()
  })

  it("gives an editor GA's figures, every comment count and the ranking", async () => {
    const rankings = [{ article: 3 }, { article: { id: 7 } }, { article: 9 }]
    const response = await articleStatsHandler(request({ rankings }).req)
    const stats = await body(response)

    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(stats.published).toBe(true)
    expect(stats.narration).toBe(false)
    expect(stats.analytics).toEqual({
      status: "ok",
      figures,
      fetchedAt: expect.any(String),
      throttled: false,
      reportsUrl: "https://analytics.example/p1",
    })
    expect(ga.pageFigures).toHaveBeenCalledWith({
      path: "/articles/a-story",
      since: "2026-11-01",
      countEvent: "narration_play",
    })
    expect(stats.comments).toEqual({
      published: 4,
      held: 2,
      hidden: 1,
      url: expect.stringMatching(/\/articles\/a-story#comments$/),
      moderateUrl: "/admin/collections/comments?where%5Btarget%5D%5Bequals%5D=7",
    })
    expect(stats.ranking).toEqual({ position: 2, of: 3 })
  })

  it("gives a credited writer published comments only, and no link into GA", async () => {
    const stats = await body(await articleStatsHandler(request({ user: writer }).req))

    expect(stats.analytics).toMatchObject({ status: "ok", reportsUrl: null })
    expect(stats.comments).toEqual({ published: 4, url: expect.stringContaining("#comments") })
    expect(stats.ranking).toBeNull()
  })

  it("lets the narrator of the article's audio see it, and says it has narration", async () => {
    const user = { id: 5, roles: ["narrator"] }
    const article = { ...published, narration: 11 }
    const stats = await body(await articleStatsHandler(request({ user, article, narrator: 5 }).req))

    expect(stats.narration).toBe(true)
  })

  it("leaves comments out while the comments switch is off", async () => {
    const { req, payload } = request({ comments: false })
    const stats = await body(await articleStatsHandler(req))

    expect(stats.comments).toBeNull()
    expect(payload.count).not.toHaveBeenCalled()
  })

  it("counts from GA's first day when the article has no publication date", async () => {
    await articleStatsHandler(request({ article: { ...published, publishedAt: null } }).req)
    expect(ga.pageFigures).toHaveBeenCalledWith(expect.objectContaining({ since: "2015-08-14" }))
  })

  it("says GA isn't connected when this site has no credentials", async () => {
    ga.configured = false
    const stats = await body(await articleStatsHandler(request().req))

    expect(stats.analytics).toEqual({ status: "unconfigured" })
    expect(ga.pageFigures).not.toHaveBeenCalled()
  })

  it("still shows comments and the ranking when GA fails, and logs it", async () => {
    ga.pageFigures.mockRejectedValue(new Error("quota"))
    const { req, payload } = request()
    const stats = await body(await articleStatsHandler(req))

    expect(stats.analytics).toEqual({ status: "error" })
    expect(stats.comments).toMatchObject({ published: 4 })
    expect(payload.logger.warn).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      "Google Analytics figures for article 7 failed",
    )
  })

  it("reads GA once an hour, and Refresh straight after keeps the figures it has", async () => {
    await articleStatsHandler(request().req)
    await articleStatsHandler(request().req)
    const refreshed = await body(await refreshArticleStatsHandler(request().req))

    expect(ga.pageFigures).toHaveBeenCalledTimes(1)
    expect(refreshed.analytics).toMatchObject({ status: "ok", throttled: true })
  })
})
