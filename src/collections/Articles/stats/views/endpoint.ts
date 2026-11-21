import type { PayloadRequest } from "payload"

import { recordView } from "./count"
import { clientAddress, createViewLimiter, isLikelyBot } from "./filter"

/** The one limiter the view endpoint uses. */
export const viewLimiter = createViewLimiter()

const noContent = (): Response =>
  new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } })

/**
 * POST /api/articles/:id/view — the article page sends this once per visit
 * (`ArticleViewBeacon`). Anyone may send it: it reads no cookie and stores no detail of the
 * reader, only one more view on today's count. It answers 204 whether or not the view
 * counted, so it says nothing about which ids are published.
 */
export async function recordArticleViewHandler(req: PayloadRequest): Promise<Response> {
  const id = Number(req.routeParams?.id)
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Invalid article" }, { status: 400 })
  }
  if (isLikelyBot(req.headers.get("user-agent"))) return noContent()

  const address = clientAddress(req.headers)
  if (address && !viewLimiter.allow(address, id)) return noContent()

  try {
    await recordView(req.payload, id)
  } catch (err) {
    req.payload.logger.warn({ err }, `Counting a view of article ${id} failed`)
  }
  return noContent()
}
