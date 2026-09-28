import { afterEach, describe, expect, it, vi } from "vitest"

const { BetaAnalyticsDataClient } = vi.hoisted(() => ({ BetaAnalyticsDataClient: vi.fn() }))
vi.mock("@google-analytics/data", () => ({ BetaAnalyticsDataClient }))

import {
  buildCandidatesFromDB,
  createAnalyticsClient,
  DECAY_LAMBDA,
  fetchGA4Metrics,
  MAX_RANKINGS,
  MIN_TOTAL_USERS,
  readGA4Env,
  scoreArticles,
  writeRankings,
  type ArticleCandidate,
  type ArticleMetrics,
  type ScoredArticle,
} from "../logic"

type Row = [path: string, scrolled?: string, total?: string]

function analyticsReturning(rows: Row[] | undefined) {
  const runReport = vi.fn().mockResolvedValue([
    {
      rows: rows?.map(([path, scrolled, total]) => ({
        dimensionValues: [{ value: path }],
        metricValues: [{ value: scrolled }, { value: total }],
      })),
    },
  ])
  return { client: { runReport } as never, runReport }
}

const metrics = (scrolledUsers: number, totalUsers: number): ArticleMetrics => ({
  scrolledUsers,
  totalUsers,
  scrollRate: totalUsers > 0 ? scrolledUsers / totalUsers : 0,
})

const NOW = Date.parse("2026-09-23T00:00:00.000Z")
const weeksAgo = (weeks: number): Date => new Date(NOW - weeks * 7 * 24 * 60 * 60 * 1000)

function candidate(overrides: Partial<ArticleCandidate> = {}): ArticleCandidate {
  return {
    id: 1,
    slug: "a",
    title: "A",
    publishedAt: weeksAgo(0),
    metrics: metrics(50, 100),
    isLatestVolume: false,
    ...overrides,
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("readGA4Env", () => {
  it("returns the credentials and turns escaped newlines in the key into real ones", () => {
    vi.stubEnv("GA4_PROPERTY_ID", "123")
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL", "svc@example.iam.gserviceaccount.com")
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", "-----BEGIN-----\\nabc\\n-----END-----")

    expect(readGA4Env()).toEqual({
      propertyId: "123",
      clientEmail: "svc@example.iam.gserviceaccount.com",
      privateKey: "-----BEGIN-----\nabc\n-----END-----",
    })
  })

  it.each([
    "GA4_PROPERTY_ID",
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  ])("throws when %s is missing", (missing) => {
    vi.stubEnv("GA4_PROPERTY_ID", "123")
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL", "svc@example.com")
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", "key")
    vi.stubEnv(missing, "")

    expect(() => readGA4Env()).toThrow("Missing required env vars")
  })
})

describe("createAnalyticsClient", () => {
  it("uses the HTTP fallback, since production blocks gRPC", () => {
    createAnalyticsClient("svc@example.com", "key")

    expect(BetaAnalyticsDataClient).toHaveBeenCalledWith({
      credentials: { client_email: "svc@example.com", private_key: "key" },
      fallback: true,
    })
  })
})

describe("fetchGA4Metrics", () => {
  it("queries article page paths over the configured date range", async () => {
    const { client, runReport } = analyticsReturning([])
    await fetchGA4Metrics(client, "123")

    expect(runReport).toHaveBeenCalledWith(
      expect.objectContaining({
        property: "properties/123",
        dateRanges: [{ startDate: "90daysAgo", endDate: "today" }],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "scrolledUsers" }, { name: "totalUsers" }],
        dimensionFilter: {
          filter: {
            fieldName: "pagePath",
            stringFilter: { matchType: "BEGINS_WITH", value: "/articles/" },
          },
        },
      }),
    )
  })

  it("merges path variants of the same slug and computes the scroll rate", async () => {
    const { client } = analyticsReturning([
      ["/articles/the-written-word", "10", "20"],
      ["/articles/the-written-word/", "5", "10"],
      ["/articles/the-written-word?utm_source=x", "3", "5"],
      ["/articles/the-written-word#footnotes", "2", "5"],
      ["/articles/other", "1", "4"],
    ])

    const result = await fetchGA4Metrics(client, "123")

    expect(result.get("the-written-word")).toEqual({
      scrolledUsers: 20,
      totalUsers: 40,
      scrollRate: 0.5,
    })
    expect(result.get("other")).toEqual({ scrolledUsers: 1, totalUsers: 4, scrollRate: 0.25 })
    expect(result.size).toBe(2)
  })

  it("skips the bare /articles/ index and treats missing values as zero", async () => {
    const { client } = analyticsReturning([
      ["/articles/", "9", "9"],
      ["/articles/no-values", undefined, undefined],
    ])

    const result = await fetchGA4Metrics(client, "123")

    expect([...result.keys()]).toEqual(["no-values"])
    expect(result.get("no-values")).toEqual({ scrolledUsers: 0, totalUsers: 0, scrollRate: 0 })
  })

  it("returns an empty map when the report has no rows", async () => {
    const { client } = analyticsReturning(undefined)
    expect((await fetchGA4Metrics(client, "123")).size).toBe(0)
  })
})

describe("scoreArticles", () => {
  it(`drops articles under ${MIN_TOTAL_USERS} users unless they're in the latest volume`, () => {
    const scored = scoreArticles(
      [
        candidate({ slug: "popular", metrics: metrics(5, MIN_TOTAL_USERS) }),
        candidate({ slug: "quiet", metrics: metrics(1, MIN_TOTAL_USERS - 1) }),
        candidate({ slug: "new-and-quiet", metrics: metrics(1, 2), isLatestVolume: true }),
      ],
      NOW,
    )

    expect(scored.map((s) => s.slug).sort()).toEqual(["new-and-quiet", "popular"])
  })

  it("decays the scroll rate exponentially by weeks since publish", () => {
    const [scored] = scoreArticles(
      [candidate({ publishedAt: weeksAgo(4), metrics: metrics(80, 100) })],
      NOW,
    )

    const decay = Math.exp(-DECAY_LAMBDA * 4)
    expect(scored).toEqual<ScoredArticle>({
      id: 1,
      slug: "a",
      title: "A",
      totalUsers: 100,
      scrolledUsers: 80,
      scrollRate: 0.8,
      weeksSincePublish: 4,
      recencyMultiplier: Math.round(decay * 1000) / 1000,
      engagementScore: Math.round(0.8 * decay * 1_000_000) / 1_000_000,
      publishedAt: weeksAgo(4).toISOString().slice(0, 10),
    })
  })

  it("ranks by engagement score, so a fresher article can beat a higher scroll rate", () => {
    const scored = scoreArticles(
      [
        candidate({ slug: "old-great", publishedAt: weeksAgo(20), metrics: metrics(90, 100) }),
        candidate({ slug: "new-good", publishedAt: weeksAgo(1), metrics: metrics(50, 100) }),
      ],
      NOW,
    )

    expect(scored.map((s) => s.slug)).toEqual(["new-good", "old-great"])
  })
})

describe("buildCandidatesFromDB", () => {
  function payloadWith(articles: unknown[], latestVolumeArticles: unknown[]) {
    const find = vi.fn(async ({ collection }: { collection: string }) =>
      collection === "articles"
        ? { docs: articles }
        : { docs: [{ volumeNumber: 9, articles: latestVolumeArticles }] },
    )
    return { payload: { find } as never, find }
  }

  it("joins GA4 metrics onto published articles and flags the latest volume", async () => {
    const { payload } = payloadWith(
      [
        { id: 1, slug: "in-latest", title: "In latest", publishedAt: "2026-09-01T00:00:00.000Z" },
        { id: 2, slug: "older", title: "Older", publishedAt: "2026-06-01T00:00:00.000Z" },
      ],
      [{ id: 1 }, 99],
    )
    const bySlug = new Map([
      ["in-latest", metrics(1, 2)],
      ["older", metrics(30, 60)],
    ])

    const candidates = await buildCandidatesFromDB(payload, bySlug)

    expect(candidates).toEqual([
      {
        id: 1,
        slug: "in-latest",
        title: "In latest",
        publishedAt: new Date("2026-09-01T00:00:00.000Z"),
        metrics: metrics(1, 2),
        isLatestVolume: true,
      },
      {
        id: 2,
        slug: "older",
        title: "Older",
        publishedAt: new Date("2026-06-01T00:00:00.000Z"),
        metrics: metrics(30, 60),
        isLatestVolume: false,
      },
    ])
  })

  it("skips articles with no traffic or no slug/publish date", async () => {
    const { payload } = payloadWith(
      [
        { id: 1, slug: "no-traffic", title: "x", publishedAt: "2026-09-01T00:00:00.000Z" },
        { id: 2, slug: null, title: "x", publishedAt: "2026-09-01T00:00:00.000Z" },
        { id: 3, slug: "no-date", title: "x", publishedAt: null },
      ],
      [],
    )
    const bySlug = new Map([["no-date", metrics(1, 1)]])

    expect(await buildCandidatesFromDB(payload, bySlug)).toEqual([])
  })

  it("reads only published articles and the newest volume", async () => {
    const { payload, find } = payloadWith([], [])
    await buildCandidatesFromDB(payload, new Map())

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "articles", draft: false, pagination: false }),
    )
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "volumes",
        draft: false,
        limit: 1,
        sort: "-volumeNumber",
      }),
    )
  })
})

describe("writeRankings", () => {
  it(`stores the top ${MAX_RANKINGS} in the article-recommendations global`, async () => {
    const updateGlobal = vi.fn()
    const scored = Array.from({ length: MAX_RANKINGS + 5 }, (_, i) => ({
      id: i + 1,
      engagementScore: 1 - i / 100,
    })) as ScoredArticle[]

    const { count } = await writeRankings({ updateGlobal } as never, scored)

    expect(count).toBe(MAX_RANKINGS)
    expect(updateGlobal).toHaveBeenCalledWith({
      slug: "article-recommendations",
      data: {
        lastUpdated: expect.any(String),
        rankings: scored.slice(0, MAX_RANKINGS).map((s) => ({
          article: s.id,
          engagementScore: s.engagementScore,
        })),
      },
    })
  })
})
