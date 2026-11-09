import type { Endpoint, PayloadRequest } from "payload"

import { isEditor } from "@/access/roles"
import { NARRATION_PLAY_EVENT } from "@/components/NarrationPlayer/events"
import { googleAnalytics, integrationStatus } from "@/integrations"
import type { PageFigures } from "@/integrations/google/analytics"
import type { User } from "@/payload-types"
import { absoluteURL } from "@/utilities/getURL"
import { docPath } from "@/utilities/routes"
import { relationshipId } from "@/utilities/relationships"

import { canSeeArticleStats } from "./access"
import { articleFiguresCache } from "./figures"

export type GoogleAnalyticsStats =
  | {
      status: "ok"
      figures: PageFigures
      /** When GA answered (ISO 8601). */
      fetchedAt: string
      /** True when Refresh came within a minute of the last fetch, so these are the cached ones. */
      throttled: boolean
      /** GA's own reports, for editors (who are the ones likely to have access to it). */
      reportsUrl: string | null
    }
  /** No credentials on this site: only production has a property with readers. */
  | { status: "unconfigured" }
  | { status: "error" }

export interface ArticleStats {
  /** False for an article that's never been published: there's nothing to count yet. */
  published: boolean
  /** Whether the article has narration audio, so the tab shows its plays. */
  narration: boolean
  /** Null until the article is published. */
  analytics: GoogleAnalyticsStats | null
  /** Null while the comments switch is off. */
  comments: {
    published: number
    /** Held by a check or hidden by a moderator; for editors only. */
    held?: number
    hidden?: number
    /** The comment section under the article on the site. */
    url: string
    /** The admin's list of this article's comments; for editors only. */
    moderateUrl?: string
  } | null
  /** Its place in the recommendations, or null when it isn't ranked. */
  ranking: { position: number; of: number } | null
}

/** The day (YYYY-MM-DD) GA should start counting from: the day it was published. */
const sinceDay = (publishedAt: string | null | undefined): string => {
  const date = publishedAt ? new Date(publishedAt) : null
  return date && !Number.isNaN(date.getTime())
    ? date.toISOString().slice(0, 10)
    : // GA4's earliest date.
      "2015-08-14"
}

async function analyticsFor(
  req: PayloadRequest,
  article: { id: number; slug: string; publishedAt?: string | null },
  refresh: boolean,
): Promise<GoogleAnalyticsStats> {
  if (!integrationStatus(googleAnalytics).configured) return { status: "unconfigured" }
  const path = docPath("articles", article.slug)
  const since = sinceDay(article.publishedAt)
  try {
    const result = await articleFiguresCache.get(
      `${article.id}:${path}:${since}`,
      () => googleAnalytics.pageFigures({ path, since, countEvent: NARRATION_PLAY_EVENT }),
      { refresh },
    )
    return {
      status: "ok",
      figures: result.figures,
      fetchedAt: new Date(result.fetchedAt).toISOString(),
      throttled: result.throttled,
      reportsUrl: isEditor(req.user as User) ? googleAnalytics.reportsUrl() : null,
    }
  } catch (err) {
    req.payload.logger.warn({ err }, `Google Analytics figures for article ${article.id} failed`)
    return { status: "error" }
  }
}

async function commentsFor(
  req: PayloadRequest,
  articleId: number,
  slug: string,
): Promise<ArticleStats["comments"]> {
  const { payload } = req
  const plugins = await payload.findGlobal({ slug: "plugins", depth: 0, overrideAccess: true })
  if (plugins.switches?.comments !== true) return null
  const count = async (status: string) =>
    (
      await payload.count({
        collection: "comments",
        overrideAccess: true,
        where: { target: { equals: articleId }, status: { equals: status } },
        req,
      })
    ).totalDocs
  const url = absoluteURL(`${docPath("articles", slug)}#comments`)
  if (!isEditor(req.user as User)) return { published: await count("published"), url }
  const [published, held, hidden] = await Promise.all([
    count("published"),
    count("auto-hidden"),
    count("hidden"),
  ])
  const moderateUrl = `${payload.config.routes.admin}/collections/comments?${new URLSearchParams({
    "where[target][equals]": String(articleId),
  })}`
  return { published, held, hidden, url, moderateUrl }
}

async function rankingFor(
  req: PayloadRequest,
  articleId: number,
): Promise<ArticleStats["ranking"]> {
  const recommendations = await req.payload.findGlobal({
    slug: "article-recommendations",
    depth: 0,
    overrideAccess: true,
  })
  const rankings = recommendations.rankings ?? []
  const index = rankings.findIndex((row) => relationshipId(row.article) === articleId)
  return index === -1 ? null : { position: index + 1, of: rankings.length }
}

async function statsHandler(req: PayloadRequest, refresh: boolean): Promise<Response> {
  const user = req.user as User | null
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const id = Number(req.routeParams?.id)
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Invalid article" }, { status: 400 })
  }

  // The published version: its slug is the page readers have been counted on.
  const article = await req.payload.findByID({
    collection: "articles",
    id,
    depth: 0,
    draft: false,
    overrideAccess: true,
    disableErrors: true,
    select: { slug: true, publishedAt: true, authors: true, narration: true, _status: true },
    req,
  })
  if (!article) return Response.json({ error: "Not found" }, { status: 404 })
  if (!(await canSeeArticleStats(req.payload, user, article))) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const published = article._status === "published" && Boolean(article.slug)
  if (!published) {
    const body: ArticleStats = {
      published: false,
      narration: false,
      analytics: null,
      comments: null,
      ranking: null,
    }
    return Response.json(body, { headers: { "Cache-Control": "private, no-store" } })
  }

  const [analytics, comments, ranking] = await Promise.all([
    analyticsFor(
      req,
      { id, slug: article.slug as string, publishedAt: article.publishedAt },
      refresh,
    ),
    commentsFor(req, id, article.slug as string),
    rankingFor(req, id),
  ])
  const narration = relationshipId(article.narration) !== null
  const body: ArticleStats = { published: true, narration, analytics, comments, ranking }
  return Response.json(body, { headers: { "Cache-Control": "private, no-store" } })
}

/** GET /api/articles/:id/stats — the Stats tab's figures, GA's from the hour-long cache. */
export const articleStatsHandler = (req: PayloadRequest): Promise<Response> =>
  statsHandler(req, false)

/** POST /api/articles/:id/stats/refresh — asks GA again, at most once a minute per article. */
export const refreshArticleStatsHandler = (req: PayloadRequest): Promise<Response> =>
  statsHandler(req, true)

export const articleStatsEndpoints: Endpoint[] = [
  { path: "/:id/stats", method: "get", handler: articleStatsHandler },
  { path: "/:id/stats/refresh", method: "post", handler: refreshArticleStatsHandler },
]
