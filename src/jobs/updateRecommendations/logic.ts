import { BetaAnalyticsDataClient } from "@google-analytics/data"
import type { Payload } from "payload"

/** Exponential decay factor per week. 0.15 ≈ half-life of ~4.6 weeks. */
export const DECAY_LAMBDA = 0.15

/** How many top articles to store in the global. */
export const MAX_RANKINGS = 20

/** GA4 date range to query. */
export const DATE_RANGE_START = "90daysAgo"

/**
 * Minimum total users an article must have to be included in rankings.
 * Articles in the latest volume are exempt from this threshold.
 */
export const MIN_TOTAL_USERS = 10

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

export interface Logger {
  debug: (msg: string) => void
  info: (msg: string) => void
  warn: (msg: string) => void
  error: (msg: string) => void
}

export interface ArticleMetrics {
  scrolledUsers: number
  totalUsers: number
  scrollRate: number
}

export interface ArticleCandidate {
  /** Payload article ID (null in dry-run mode). */
  id: number | null
  slug: string
  title: string
  publishedAt: Date
  metrics: ArticleMetrics
  isLatestVolume: boolean
}

export interface ScoredArticle {
  id: number | null
  slug: string
  title: string
  totalUsers: number
  scrolledUsers: number
  scrollRate: number
  weeksSincePublish: number
  recencyMultiplier: number
  engagementScore: number
  publishedAt: string
}

export function readGA4Env(): {
  propertyId: string
  clientEmail: string
  privateKey: string
} {
  const propertyId = process.env.GA4_PROPERTY_ID
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n")
  if (!propertyId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing required env vars: GA4_PROPERTY_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    )
  }
  return { propertyId, clientEmail, privateKey }
}

export function createAnalyticsClient(
  clientEmail: string,
  privateKey: string,
): BetaAnalyticsDataClient {
  return new BetaAnalyticsDataClient({
    credentials: { client_email: clientEmail, private_key: privateKey },
    // Fallback is needed because gRPC is blocked inside of our current production environment
    fallback: true,
  })
}

export async function fetchGA4Metrics(
  analytics: BetaAnalyticsDataClient,
  propertyId: string,
): Promise<Map<string, ArticleMetrics>> {
  const [report] = await analytics.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: DATE_RANGE_START, endDate: "today" }],
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "scrolledUsers" }, { name: "totalUsers" }],
    dimensionFilter: {
      filter: {
        fieldName: "pagePath",
        stringFilter: {
          matchType: "BEGINS_WITH",
          value: "/articles/",
        },
      },
    },
  })

  const metricsBySlug = new Map<string, { scrolled: number; total: number }>()
  for (const row of report?.rows || []) {
    const pagePath = row.dimensionValues?.[0]?.value || ""
    const slug = pagePath.replace(/^\/articles\//, "").replace(/[/?#].*$/, "")
    if (!slug) continue

    const scrolled = parseInt(row.metricValues?.[0]?.value || "0", 10)
    const total = parseInt(row.metricValues?.[1]?.value || "0", 10)
    const existing = metricsBySlug.get(slug) || { scrolled: 0, total: 0 }
    metricsBySlug.set(slug, {
      scrolled: existing.scrolled + scrolled,
      total: existing.total + total,
    })
  }

  const result = new Map<string, ArticleMetrics>()
  for (const [slug, { scrolled, total }] of metricsBySlug) {
    result.set(slug, {
      scrolledUsers: scrolled,
      totalUsers: total,
      scrollRate: total > 0 ? scrolled / total : 0,
    })
  }

  return result
}

export function scoreArticles(candidates: ArticleCandidate[], now: number): ScoredArticle[] {
  return candidates
    .filter((c) => c.metrics.totalUsers >= MIN_TOTAL_USERS || c.isLatestVolume)
    .map((c) => {
      const weeksSincePublish = (now - c.publishedAt.getTime()) / MS_PER_WEEK
      const recencyMultiplier = Math.exp(-DECAY_LAMBDA * weeksSincePublish)
      const engagementScore = c.metrics.scrollRate * recencyMultiplier

      return {
        id: c.id,
        slug: c.slug,
        title: c.title,
        totalUsers: c.metrics.totalUsers,
        scrolledUsers: c.metrics.scrolledUsers,
        scrollRate: Math.round(c.metrics.scrollRate * 10000) / 10000,
        weeksSincePublish: Math.round(weeksSincePublish * 10) / 10,
        recencyMultiplier: Math.round(recencyMultiplier * 1000) / 1000,
        engagementScore: Math.round(engagementScore * 1_000_000) / 1_000_000,
        publishedAt: c.publishedAt.toISOString().slice(0, 10),
      }
    })
    .sort((a, b) => b.engagementScore - a.engagementScore)
}

/* 
  buildCandidatesFromSite fetches the public pragmatic papers site to find a set of current articles
  so that we can mimic running against the production databse.

  i.e. only used locally to try out recommendation algo candidates
*/
export async function buildCandidatesFromSite(
  metricsBySlug: Map<string, ArticleMetrics>,
  logger: Logger,
): Promise<ArticleCandidate[]> {
  const SITE_URL = "https://pragmaticpapers.com"
  const articleLinkRegex = /href="\/articles\/([^"]+)"/g
  const dateTimeRegex = /<time\s+dateTime="([^"]+)"/i

  const slugDates = new Map<string, Date>()
  const latestVolumeSlugs = new Set<string>()

  logger.info(`Fetching volume pages from ${SITE_URL}...`)

  let volumeNum = 38
  let consecutive404s = 0
  let isLatestVolume = true
  while (consecutive404s < 3) {
    const res = await fetch(`${SITE_URL}/volumes/${volumeNum}`)
    if (!res.ok) {
      consecutive404s++
      volumeNum--
      continue
    }
    consecutive404s = 0

    const html = await res.text()
    const dateMatch = dateTimeRegex.exec(html)
    const publishDate = dateMatch?.[1] ? new Date(dateMatch[1]) : null

    let articleCount = 0
    let linkMatch: RegExpExecArray | null
    while ((linkMatch = articleLinkRegex.exec(html)) !== null) {
      const slug = linkMatch[1]
      if (slug && !slugDates.has(slug)) {
        if (publishDate) slugDates.set(slug, publishDate)
        if (isLatestVolume) latestVolumeSlugs.add(slug)
        articleCount++
      }
    }

    logger.info(
      `  Volume ${volumeNum}: ${articleCount} articles, published ${publishDate?.toISOString().slice(0, 10) ?? "unknown"}`,
    )
    isLatestVolume = false
    volumeNum--
  }

  logger.info(`Mapped ${slugDates.size} articles to publish dates`)

  const candidates: ArticleCandidate[] = []
  for (const [slug, publishedAt] of slugDates) {
    const metrics = metricsBySlug.get(slug)
    if (!metrics) continue
    candidates.push({
      id: null,
      slug,
      title: slug,
      publishedAt,
      metrics,
      isLatestVolume: latestVolumeSlugs.has(slug),
    })
  }

  return candidates
}

export async function buildCandidatesFromDB(
  payload: Payload,
  metricsBySlug: Map<string, ArticleMetrics>,
  logger?: Logger,
): Promise<ArticleCandidate[]> {
  const articles = await payload.find({
    collection: "articles",
    draft: false,
    limit: 1000,
    pagination: false,
    overrideAccess: true,
    select: {
      slug: true,
      title: true,
      publishedAt: true,
    },
  })
  logger?.debug(`  loaded ${articles.docs.length} published articles from Payload`)

  const latestVolume = await payload.find({
    collection: "volumes",
    draft: false,
    limit: 1,
    sort: "-volumeNumber",
    overrideAccess: true,
    select: {
      articles: true,
      volumeNumber: true,
    },
  })

  const latestVolumeDoc = latestVolume.docs[0]
  const latestVolumeArticleIds = new Set<number>()
  for (const ref of latestVolumeDoc?.articles || []) {
    latestVolumeArticleIds.add(typeof ref === "number" ? ref : ref.id)
  }
  logger?.debug(
    `  latest volume = #${latestVolumeDoc?.volumeNumber ?? "?"} with ${latestVolumeArticleIds.size} articles (these bypass the user-count minimum)`,
  )

  let missingMetrics = 0
  let missingMeta = 0
  const candidates: ArticleCandidate[] = []
  for (const article of articles.docs) {
    if (!article.slug || !article.publishedAt) {
      missingMeta++
      continue
    }
    const metrics = metricsBySlug.get(article.slug)
    if (!metrics) {
      missingMetrics++
      continue
    }
    candidates.push({
      id: article.id,
      slug: article.slug,
      title: article.title,
      publishedAt: new Date(article.publishedAt),
      metrics,
      isLatestVolume: latestVolumeArticleIds.has(article.id),
    })
  }
  logger?.debug(
    `  joined GA4 metrics → articles: ${candidates.length} matched, ${missingMetrics} articles had no GA4 traffic, ${missingMeta} skipped (missing slug/publishedAt)`,
  )

  return candidates
}

export async function writeRankings(
  payload: Payload,
  scored: ScoredArticle[],
  logger?: Logger,
): Promise<{ count: number }> {
  const topRankings = scored.slice(0, MAX_RANKINGS).map((s) => ({
    article: s.id!,
    engagementScore: s.engagementScore,
  }))

  logger?.debug(
    `  persisting ${topRankings.length} ranking rows (capped at MAX_RANKINGS=${MAX_RANKINGS}) into the 'article-recommendations' global`,
  )
  await payload.updateGlobal({
    slug: "article-recommendations",
    data: {
      lastUpdated: new Date().toISOString(),
      rankings: topRankings,
    },
  })
  logger?.debug("  global update committed")

  return { count: topRankings.length }
}

export function logRawMetrics(metricsBySlug: Map<string, ArticleMetrics>, logger: Logger): void {
  const sortedByTotal = [...metricsBySlug.entries()].sort(
    (a, b) => b[1].totalUsers - a[1].totalUsers,
  )
  logger.debug("Raw metrics (top 30 by traffic):")
  logger.debug(
    `${"".padStart(6)} | ${"Total".padStart(5)} | ${"Scroll".padStart(6)} | ${"Rate".padStart(6)} | Slug`,
  )
  for (const [slug, m] of sortedByTotal.slice(0, 30)) {
    logger.debug(
      `${"".padStart(6)} | ${String(m.totalUsers).padStart(5)} | ${String(m.scrolledUsers).padStart(6)} | ${(m.scrollRate * 100).toFixed(1).padStart(5)}% | ${slug}`,
    )
  }
}

export function logFilteredArticles(candidates: ArticleCandidate[], logger: Logger): void {
  const filtered = candidates.filter(
    (c) => c.metrics.totalUsers < MIN_TOTAL_USERS && !c.isLatestVolume,
  )
  if (filtered.length > 0) {
    logger.debug(
      `\nFiltered out ${filtered.length} articles with < ${MIN_TOTAL_USERS} total users:`,
    )
    for (const c of filtered.slice(0, 10)) {
      logger.debug(
        `  ${c.metrics.totalUsers} users, ${(c.metrics.scrollRate * 100).toFixed(0)}% rate - ${c.slug}`,
      )
    }
  }
}

export function logRankings(scored: ScoredArticle[], logger: Logger): void {
  logger.debug(
    `\n=== FINAL RANKINGS (scrollRate × recency decay, min ${MIN_TOTAL_USERS} users) ===\n`,
  )
  logger.debug(
    `${"#".padStart(3)} | ${"Score".padStart(10)} | ${"Users".padStart(5)} | ${"Scrolled".padStart(8)} | ${"Rate".padStart(6)} | ${"Decay".padStart(5)} | ${"Wks".padStart(4)} | ${"Published".padEnd(10)} | Slug`,
  )
  logger.debug("-".repeat(120))
  for (let i = 0; i < Math.min(scored.length, 30); i++) {
    const s = scored[i]!
    logger.debug(
      `${String(i + 1).padStart(3)} | ${s.engagementScore.toFixed(6).padStart(10)} | ${String(s.totalUsers).padStart(5)} | ${String(s.scrolledUsers).padStart(8)} | ${(s.scrollRate * 100).toFixed(1).padStart(5)}% | ${s.recencyMultiplier.toFixed(3).padStart(5)} | ${s.weeksSincePublish.toFixed(1).padStart(4)} | ${s.publishedAt.padEnd(10)} | ${s.slug}`,
    )
  }
}

export async function seedRandomRankings(payload: Payload): Promise<number> {
  const articles = await payload.find({
    collection: "articles",
    draft: false,
    limit: 1000,
    pagination: false,
    overrideAccess: true,
    select: { slug: true, title: true },
  })

  if (articles.docs.length === 0) {
    throw new Error("No published articles found in the database.")
  }

  const shuffled = articles.docs.sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, MAX_RANKINGS)

  const topRankings = selected.map((article) => ({
    article: article.id,
    engagementScore: Math.round(Math.random() * 1_000_000) / 1_000_000,
  }))

  await payload.updateGlobal({
    slug: "article-recommendations",
    data: {
      lastUpdated: new Date().toISOString(),
      rankings: topRankings,
    },
  })

  return topRankings.length
}
