import { after } from "next/server"

import { flushEdgeCachePurge, purgeEdgeCache } from "@/hooks/purgeEdgeCache"
import { getPayloadClient } from "@/data/payload"

import { hasPayloadSecret } from "../bearer"
import { PURGE_SETTLE_MS, warmPages } from "./warmPages"

/**
 * Purge Cloudflare's edge once a deploy has taken over. `dockerfiles/scripts/start.sh` gives
 * each container a random `INSTANCE_ID` and, after `/next/revalidate-all`, polls GET on its
 * public URL until the answer names its own id: until Coolify's health check passes and it
 * moves traffic over, the old container answers, and a purge would only refill the edge with
 * the previous release's pages (whose scripts the new container no longer serves). Then it
 * POSTs here on localhost to purge. Once the purge has gone out, the most-read pages are
 * requested through the public URL (`warmPages`), so the first readers find them cached.
 *
 * Both authenticated with `Authorization: Bearer <PAYLOAD_SECRET>`, like `/next/revalidate-all`.
 */
export function GET(request: Request): Response {
  if (!hasPayloadSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  return Response.json(
    { instance: process.env.INSTANCE_ID ?? null },
    { headers: { "Cache-Control": "no-store" } },
  )
}

export async function POST(request: Request): Promise<Response> {
  if (!hasPayloadSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  const payload = await getPayloadClient()
  purgeEdgeCache(payload.logger, "deploy")
  // The purge and the warm-up run after the response, and neither throws.
  after(async () => {
    await flushEdgeCachePurge()
    await new Promise((resolve) => setTimeout(resolve, PURGE_SETTLE_MS))
    await warmPages(payload)
  })
  return Response.json({ queued: true })
}
