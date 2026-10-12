import { after } from "next/server"

import { warmWorker } from "@/hooks/warmWorker"
import { PURGE_SETTLE_MS } from "@/hooks/warmPages"
import { getPayloadClient } from "@/data/payload"
import { cloudflareWorkerCache, describeStatus, integrationStatus } from "@/integrations"

import { hasPayloadSecret } from "../bearer"

/**
 * Warm the Cloudflare Worker's most-read pages from here, once its deploy has emptied its
 * cache. The Worker's deploy workflow calls it on the deployment whose database the Worker
 * reads, after the Worker's `/next/revalidate-all`: this one can look up the newest volume, and
 * a Worker requesting its own pages would only reach itself. Answers at once; the warm-up runs
 * after, once the purge has had time to reach every data center.
 *
 * Authenticated with `Authorization: Bearer <PAYLOAD_SECRET>`, like `/next/revalidate-all`.
 */
export async function POST(request: Request): Promise<Response> {
  if (!hasPayloadSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  const status = integrationStatus(cloudflareWorkerCache)
  if (!status.configured) {
    return Response.json({ queued: false, reason: describeStatus(status) })
  }
  const payload = await getPayloadClient()
  after(async () => {
    await new Promise((resolve) => setTimeout(resolve, PURGE_SETTLE_MS))
    await warmWorker(payload)
  })
  return Response.json({ queued: true })
}
