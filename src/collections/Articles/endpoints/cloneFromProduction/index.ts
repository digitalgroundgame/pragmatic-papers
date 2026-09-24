import type { Endpoint, PayloadRequest } from "payload"

import { isAdmin } from "@/access/roles"

import { ArticleNotFoundError, cloneArticleFromProduction } from "./logic"
import { searchProductionArticles } from "./source"

/** Cloning production into itself would only duplicate its own articles. */
export const canCloneFromProduction = (): boolean => process.env.BUILD_ENV !== "production"

function refuse(req: PayloadRequest): Response | undefined {
  if (!canCloneFromProduction()) {
    return Response.json({ error: "Not available in production" }, { status: 403 })
  }
  if (!isAdmin(req.user)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
}

/**
 * GET /api/articles/production-search?q=
 *
 * Admin-only. Latest published production articles matching `q` by title,
 * each flagged with whether an article with its slug already exists here.
 */
export const productionSearchEndpoint: Endpoint = {
  path: "/production-search",
  method: "get",
  handler: async (req) => {
    const refusal = refuse(req)
    if (refusal) return refusal

    const q = typeof req.query.q === "string" ? req.query.q : ""
    try {
      const articles = await searchProductionArticles(q)
      const { docs: local } = await req.payload.find({
        collection: "articles",
        where: { slug: { in: articles.map((a) => a.slug) } },
        select: { slug: true },
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      const localSlugs = new Set(local.map((a) => a.slug))
      return Response.json({
        docs: articles.map((a) => ({ ...a, existsLocally: localSlugs.has(a.slug) })),
      })
    } catch (err) {
      req.payload.logger.error({ err }, "[clone] production search failed")
      return Response.json({ error: "Could not reach production" }, { status: 502 })
    }
  },
}

/**
 * POST /api/articles/clone-from-production  { slug }
 *
 * Admin-only. Clones one published production article, and what it
 * references, into this environment. See `cloneArticleFromProduction`.
 */
export const cloneFromProductionEndpoint: Endpoint = {
  path: "/clone-from-production",
  method: "post",
  handler: async (req) => {
    const refusal = refuse(req)
    if (refusal) return refusal

    const body = (await req.json?.().catch(() => null)) as { slug?: unknown } | null
    const slug = typeof body?.slug === "string" ? body.slug.trim() : ""
    if (!slug) return Response.json({ error: "Missing slug" }, { status: 400 })

    try {
      return Response.json(await cloneArticleFromProduction(req.payload, slug))
    } catch (err) {
      if (err instanceof ArticleNotFoundError) {
        return Response.json({ error: err.message }, { status: 404 })
      }
      req.payload.logger.error({ err }, `[clone] cloning "${slug}" from production failed`)
      const message = err instanceof Error ? err.message : "Unknown error"
      return Response.json({ error: `Clone failed: ${message}` }, { status: 500 })
    }
  },
}
