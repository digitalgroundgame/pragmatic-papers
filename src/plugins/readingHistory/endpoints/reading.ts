import type { Endpoint, PayloadRequest } from "payload"

import { MINE_PATH, READING_PATH } from "../constants"
import { isCurrentDay } from "../days"
import { recordRead, recordVisit } from "../record"
import { readingTotals } from "../totals"
import type { ReadingUser, ResolvedReadingHistoryConfig } from "../types"

const noStore = { "Cache-Control": "private, no-store" }

const notFound = () => Response.json({ message: "Not Found" }, { status: 404, headers: noStore })

/** The signed-in reader, or the response that turns the request away. */
async function reader(
  req: PayloadRequest,
  config: ResolvedReadingHistoryConfig,
): Promise<ReadingUser | Response> {
  if (!(await config.enabled(req.payload))) return notFound()
  const user = await config.currentUser(req)
  if (!user) return Response.json({ message: "Sign in first." }, { status: 401, headers: noStore })
  return user
}

const articleId = (value: unknown): number | string | null => {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value
  if (typeof value === "string" && /^[1-9]\d{0,15}$/.test(value)) return Number(value)
  return null
}

/**
 * `POST /api/reading` with `{ day, article? }`: the signed-in reader visited on `day` (their
 * calendar day), and, with `article`, read it to the end. 204 whether or not it changed
 * anything; 400 for a day that isn't today anywhere; 401 signed out; 404 while it's off.
 */
export const readingEndpoint = (config: ResolvedReadingHistoryConfig): Endpoint => ({
  path: READING_PATH,
  method: "post",
  handler: async (req) => {
    const user = await reader(req, config)
    if (user instanceof Response) return user

    let body: Record<string, unknown>
    try {
      body = ((await req.json?.()) ?? {}) as Record<string, unknown>
    } catch {
      return Response.json({ message: "Send JSON." }, { status: 400, headers: noStore })
    }
    if (!isCurrentDay(body.day, Date.now())) {
      return Response.json({ message: "That isn't today." }, { status: 400, headers: noStore })
    }

    await recordVisit(req.payload, user, body.day, config, req)
    if (body.article !== undefined) {
      const article = articleId(body.article)
      if (article === null) {
        return Response.json({ message: "No such article." }, { status: 400, headers: noStore })
      }
      await recordRead(req.payload, user, article, config, req)
    }
    return new Response(null, { status: 204, headers: noStore })
  },
})

/** `GET /api/reading/mine`: the signed-in reader's totals, for their account page. */
export const mineEndpoint = (config: ResolvedReadingHistoryConfig): Endpoint => ({
  path: MINE_PATH,
  method: "get",
  handler: async (req) => {
    const user = await reader(req, config)
    if (user instanceof Response) return user
    return Response.json(await readingTotals(req.payload, user, config, Date.now(), req), {
      headers: noStore,
    })
  },
})
