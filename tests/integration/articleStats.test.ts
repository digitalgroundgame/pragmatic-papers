import { createLocalReq, type Payload } from "payload"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { canSeeArticleStats } from "@/collections/Articles/stats/access"
import {
  articleStatsHandler,
  refreshArticleStatsHandler,
  type ArticleStats,
} from "@/collections/Articles/stats/endpoint"
import { articleFiguresCache } from "@/collections/Articles/stats/figures"
import { recordArticleViewHandler, viewLimiter } from "@/collections/Articles/stats/views/endpoint"
import { sql } from "@payloadcms/db-postgres"
import type { Article, Media, User } from "@/payload-types"
import { getSiteURL } from "@/utilities/getURL"

import { testFile } from "./fixtures/media"
import { createArticle } from "./helpers/content"
import { createUser, getPayload } from "./helpers/testUsers"

// GA's Data API, answered here: one batch per call, counting how many were made.
const ga = vi.hoisted(() => ({ calls: [] as unknown[], views: 0 }))
vi.mock("@google-analytics/data", () => ({
  BetaAnalyticsDataClient: class {
    async batchRunReports(request: unknown) {
      ga.calls.push(request)
      ga.views += 100
      const metrics = (views: number) => [
        { value: String(views) },
        { value: "80" },
        { value: "40" },
      ]
      return [
        {
          reports: [
            {
              dimensionHeaders: [{ name: "dateRange" }],
              rows: [{ dimensionValues: [{ value: "allTime" }], metricValues: metrics(ga.views) }],
            },
            {
              rows: [{ dimensionValues: [{ value: "google" }], metricValues: [{ value: "60" }] }],
            },
            {
              dimensionHeaders: [{ name: "dateRange" }],
              rows: [{ dimensionValues: [{ value: "allTime" }], metricValues: [{ value: "12" }] }],
            },
          ],
        },
      ]
    }
  },
}))

let payload: Payload

async function stats(
  user: User,
  articleId: number,
  { refresh = false } = {},
): Promise<{ status: number; body: ArticleStats }> {
  const req = await createLocalReq({ user }, payload)
  req.routeParams = { id: String(articleId) }
  const response = await (refresh ? refreshArticleStatsHandler : articleStatsHandler)(req)
  return { status: response.status, body: (await response.json()) as ArticleStats }
}

async function narrate(article: Article, narrator: User): Promise<void> {
  const audio = await payload.create({
    collection: "media",
    overrideAccess: true,
    context: { disableRevalidate: true },
    file: testFile(),
    data: { alt: "Narration", narrator: narrator.id } as unknown as Media,
  })
  // The narration field takes audio only, and a real recording is no use here: mark the
  // picture as one.
  await payload.db.updateOne({
    collection: "media",
    where: { id: { equals: audio.id } },
    data: { mimeType: "audio/mpeg" },
  })
  await payload.update({
    collection: "articles",
    id: article.id,
    overrideAccess: true,
    context: { disableRevalidate: true },
    data: { narration: audio.id },
  })
}

beforeAll(async () => {
  payload = await getPayload()
})

async function view(
  articleId: number,
  headers: Record<string, string> = { "user-agent": "Mozilla/5.0 Firefox/140.0" },
): Promise<number> {
  const req = await createLocalReq({}, payload)
  req.routeParams = { id: String(articleId) }
  req.headers = new Headers(headers)
  return (await recordArticleViewHandler(req)).status
}

beforeEach(() => {
  articleFiguresCache.clear()
  viewLimiter.clear()
  ga.calls.length = 0
  ga.views = 0
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("who sees an article's stats", () => {
  it("editors and admins on every article, writers only on their own", async () => {
    const writer = await createUser("writer")
    const otherWriter = await createUser("writer")
    const article = await createArticle({ authors: [writer.id] })

    expect(await canSeeArticleStats(payload, await createUser("editor"), article)).toBe(true)
    expect(await canSeeArticleStats(payload, await createUser("chief-editor"), article)).toBe(true)
    expect(await canSeeArticleStats(payload, await createUser("admin"), article)).toBe(true)
    expect(await canSeeArticleStats(payload, writer, article)).toBe(true)
    expect(await canSeeArticleStats(payload, otherWriter, article)).toBe(false)
    expect(await canSeeArticleStats(payload, null, article)).toBe(false)
  })

  it("narrators only on the articles they narrated", async () => {
    const writer = await createUser("writer")
    const narrator = await createUser("narrator")
    const otherNarrator = await createUser("narrator")
    const article = await createArticle({ authors: [writer.id] })

    expect(await canSeeArticleStats(payload, narrator, article)).toBe(false)

    await narrate(article, narrator)
    const narrated = await payload.findByID({ collection: "articles", id: article.id, depth: 0 })
    expect(await canSeeArticleStats(payload, narrator, narrated)).toBe(true)
    expect(await canSeeArticleStats(payload, otherNarrator, narrated)).toBe(false)

    // The narrator's tab shows the narration's plays.
    const { status, body } = await stats(narrator, article.id)
    expect(status).toBe(200)
    expect(body.narration).toBe(true)
    expect((await stats(otherNarrator, article.id)).status).toBe(403)
  })

  it("flags the article for the tab when it's opened, not in lists", async () => {
    const writer = await createUser("writer")
    const otherWriter = await createUser("writer")
    const article = await createArticle({ authors: [writer.id] })

    const read = (user: User) =>
      payload.findByID({ collection: "articles", id: article.id, overrideAccess: false, user })
    expect((await read(writer)).canSeeStats).toBe(true)
    expect((await read(otherWriter)).canSeeStats).toBe(false)

    const list = await payload.find({
      collection: "articles",
      where: { id: { equals: article.id } },
      overrideAccess: false,
      user: writer,
    })
    expect(list.docs[0]?.canSeeStats).toBeUndefined()
  })
})

describe("GET /api/articles/:id/stats", () => {
  it("refuses a writer who isn't credited", async () => {
    const article = await createArticle({ authors: [(await createUser("writer")).id] })
    const { status } = await stats(await createUser("writer"), article.id)
    expect(status).toBe(403)
  })

  it("has nothing to count before the article is published", async () => {
    const writer = await createUser("writer")
    const article = await createArticle({ authors: [writer.id], _status: "draft" })
    const { status, body } = await stats(writer, article.id)
    expect(status).toBe(200)
    expect(body).toEqual({
      published: false,
      narration: false,
      publishedOn: null,
      views: null,
      analytics: null,
      comments: null,
      ranking: null,
    })
  })

  it("says GA isn't connected where its credentials aren't set", async () => {
    const writer = await createUser("writer")
    const article = await createArticle({ authors: [writer.id] })
    const { body } = await stats(writer, article.id)
    expect(body).toMatchObject({ published: true, analytics: { status: "unconfigured" } })
    expect(ga.calls).toHaveLength(0)
  })

  it("reads GA once an hour per article, and Refresh at most once a minute", async () => {
    vi.stubEnv("GA4_PROPERTY_ID", "123")
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL", "svc@example.com")
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", "key")
    const writer = await createUser("writer")
    const article = await createArticle({ authors: [writer.id] })

    const first = await stats(writer, article.id)
    expect(first.body.analytics).toMatchObject({
      status: "ok",
      throttled: false,
      // Writers don't get the link to GA's own reports; editors do.
      reportsUrl: null,
      figures: {
        allTime: { views: 100, readers: 80, readersWhoFinished: 40, eventCount: 12 },
        last7Days: { views: 0 },
        referrers: [{ source: "google", views: 60 }],
      },
    })
    expect(JSON.stringify(ga.calls[0])).toContain(`/articles/${article.slug}`)
    // Narration plays are counted from the player's GA event.
    expect(JSON.stringify(ga.calls[0])).toContain('"value":"narration_play"')
    expect(first.body.narration).toBe(false)

    // Opening it again reads the cache.
    await stats(writer, article.id)
    expect(ga.calls).toHaveLength(1)

    // Refresh right after a fetch keeps the cached figures.
    const refreshed = await stats(writer, article.id, { refresh: true })
    expect(refreshed.body.analytics).toMatchObject({ status: "ok", throttled: true })
    expect(ga.calls).toHaveLength(1)

    const editor = await stats(await createUser("editor"), article.id)
    expect(editor.body.analytics).toMatchObject({
      reportsUrl: "https://analytics.google.com/analytics/web/#/p123/reports/intelligenthome",
    })
  })

  it("counts comments while the comments switch is on, held and hidden ones for editors", async () => {
    const writer = await createUser("writer")
    const article = await createArticle({ authors: [writer.id] })
    const comment = (status: string) =>
      payload.create({
        collection: "comments",
        overrideAccess: true,
        data: { body: "A comment", target: article.id, author: writer.id, status } as never,
      })

    await comment("published")
    await comment("published")
    await comment("auto-hidden")
    await comment("hidden")

    expect((await stats(writer, article.id)).body.comments).toBeNull()

    await payload.updateGlobal({
      slug: "plugins",
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: { switches: { comments: true } },
    })
    try {
      const url = `${getSiteURL()}/articles/${article.slug}#comments`
      expect((await stats(writer, article.id)).body.comments).toEqual({ published: 2, url })
      expect((await stats(await createUser("editor"), article.id)).body.comments).toEqual({
        published: 2,
        held: 1,
        hidden: 1,
        url,
        moderateUrl: `/admin/collections/comments?where%5Btarget%5D%5Bequals%5D=${article.id}`,
      })
    } finally {
      await payload.updateGlobal({
        slug: "plugins",
        overrideAccess: true,
        context: { disableRevalidate: true },
        data: { switches: { comments: false } },
      })
    }
  })

  it("gives the article's place in the recommendations", async () => {
    const writer = await createUser("writer")
    const other = await createArticle({ authors: [writer.id] })
    const article = await createArticle({ authors: [writer.id] })
    await payload.updateGlobal({
      slug: "article-recommendations",
      data: {
        rankings: [
          { article: other.id, engagementScore: 0.9 },
          { article: article.id, engagementScore: 0.5 },
        ],
      },
    })

    expect((await stats(writer, article.id)).body.ranking).toEqual({ position: 2, of: 2 })
  })
})

describe("POST /api/articles/:id/view", () => {
  it("counts each visit to a published article, and the Stats tab shows it", async () => {
    const writer = await createUser("writer")
    const article = await createArticle({ authors: [writer.id] })

    expect(await view(article.id)).toBe(204)
    expect(await view(article.id)).toBe(204)
    expect(
      await view(article.id, { "user-agent": "Safari/605", "x-forwarded-for": "10.0.0.2" }),
    ).toBe(204)

    const { body } = await stats(writer, article.id)
    expect(body.views).toMatchObject({ allTime: 3, last30Days: 3, last7Days: 3 })
    expect(body.views?.countingSince).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("leaves out drafts, bots and an address past its limit", async () => {
    const writer = await createUser("writer")
    const draft = await createArticle({ authors: [writer.id], _status: "draft" })
    const article = await createArticle({ authors: [writer.id] })

    expect(await view(draft.id)).toBe(204)
    expect(await view(article.id, { "user-agent": "Googlebot/2.1" })).toBe(204)
    expect(await view(article.id, { "user-agent": "HeadlessChrome/140" })).toBe(204)
    for (let i = 0; i < 25; i++) {
      await view(article.id, { "user-agent": "Firefox/140", "cf-connecting-ip": "203.0.113.9" })
    }

    const rows = await payload.db.drizzle.execute<{ article_id: number; views: number }>(sql`
      SELECT article_id, views FROM article_views WHERE article_id IN (${draft.id}, ${article.id})
    `)
    expect(rows.rows).toEqual([{ article_id: article.id, views: 20 }])
  })

  it("refuses an id that isn't one, and ignores one that doesn't exist", async () => {
    expect(await view(Number.NaN)).toBe(400)
    expect(await view(999_999_999)).toBe(204)
  })

  it("sums the ranges over the days counted, and says when counting began", async () => {
    const writer = await createUser("writer")
    const article = await createArticle({ authors: [writer.id] })
    const today = sql`(now() at time zone 'utc')::date`
    await payload.db.drizzle.execute(sql`
      INSERT INTO article_views (article_id, day, views) VALUES
        (${article.id}, ${today}, 1),
        (${article.id}, ${today} - 6, 2),
        (${article.id}, ${today} - 7, 4),
        (${article.id}, ${today} - 29, 8),
        (${article.id}, ${today} - 30, 16),
        (${article.id}, DATE '2020-01-02', 32)
    `)

    const { body } = await stats(writer, article.id)
    expect(body.views).toEqual({
      allTime: 63,
      last30Days: 15,
      last7Days: 3,
      countingSince: "2020-01-02",
    })
  })

  it("forgets an article's views when it's deleted", async () => {
    const article = await createArticle({ authors: [(await createUser("writer")).id] })
    await view(article.id)
    await payload.delete({
      collection: "articles",
      id: article.id,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })
    const rows = await payload.db.drizzle.execute(sql`
      SELECT 1 FROM article_views WHERE article_id = ${article.id}
    `)
    expect(rows.rows).toHaveLength(0)
  })
})
