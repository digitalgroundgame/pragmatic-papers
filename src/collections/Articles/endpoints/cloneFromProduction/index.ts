import type { Endpoint, PayloadRequest } from "payload"

import { isAdmin } from "@/access/roles"

import {
  ArticleNotFoundError,
  cloneArticleFromProduction,
  type CloneResult,
  type CreatedCounts,
} from "./logic"
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

/** One line of the clone endpoint's NDJSON response. */
export type CloneEvent =
  | { type: "ping" }
  | { type: "progress"; created: CreatedCounts }
  | ({ type: "done" } & CloneResult)
  | { type: "error"; message: string }

/** Cloudflare drops a response that sends nothing for 100 seconds. */
const KEEPALIVE_MS = 15_000

/**
 * POST /api/articles/clone-from-production  { slug }
 *
 * Admin-only. Clones one published production article, and what it
 * references, into this environment (see `cloneArticleFromProduction`),
 * streaming a `CloneEvent` per line as documents are created. A clone can
 * outlast the proxy's timeout, so progress and keepalive lines keep the
 * response open; the clone finishes even if the client goes away.
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

    const encoder = new TextEncoder()
    let open = true
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: CloneEvent) => {
          if (open) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
        }
        const keepalive = setInterval(() => send({ type: "ping" }), KEEPALIVE_MS)
        try {
          const result = await cloneArticleFromProduction(req.payload, slug, {
            onProgress: (created) => send({ type: "progress", created }),
          })
          send({ type: "done", ...result })
        } catch (err) {
          if (err instanceof ArticleNotFoundError) {
            send({ type: "error", message: err.message })
          } else {
            req.payload.logger.error({ err }, `[clone] cloning "${slug}" from production failed`)
            const message = err instanceof Error ? err.message : "Unknown error"
            send({ type: "error", message: `Clone failed: ${message}` })
          }
        } finally {
          clearInterval(keepalive)
          if (open) controller.close()
        }
      },
      cancel() {
        open = false
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        // Keep a buffering proxy from holding the stream back as one late chunk.
        "X-Accel-Buffering": "no",
      },
    })
  },
}
