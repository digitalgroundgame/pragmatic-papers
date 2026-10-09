import { revalidatePath } from "next/cache"

import { purgeEdgeCache } from "@/hooks/purgeEdgeCache"
import { syncRepoDocs } from "@/plugins/docs/syncRepoDocs"
import { getPayloadConfig } from "@/utilities/getPayloadConfig"

import { hasPayloadSecret } from "../bearer"

/**
 * How long after the first purge to purge Cloudflare's edge again. `start.sh` calls this route
 * as soon as the new container answers, which is before Coolify's health check passes and it
 * moves traffic over, so for a while the old container still answers the edge's misses and
 * refills it with the previous release's pages (whose scripts the new container no longer
 * serves). The second purge drops those.
 */
export const DEPLOY_REPURGE_MS = 2 * 60 * 1000

/**
 * Run once each time a deploy goes live. Writes the help docs in src/docs/ into this
 * deployment's database (`syncRepoDocs`), then throws away every page and route Next.js
 * prerendered at build time, so each renders again from that database on its next request,
 * and purges Cloudflare's edge copy of them (`purgeEdgeCache`), now and again after
 * `DEPLOY_REPURGE_MS`.
 *
 * An image built in CI is built against an empty database, so the
 * routes it bakes in (the RSS and Substack feeds) hold no content, and robots.txt and
 * the sitemap index name the build's host rather than this deployment's. An image
 * Coolify builds bakes in every article and volume as the database held them during
 * the build, which edits saved since never reach.
 * `dockerfiles/scripts/start.sh` calls this once the server is up, for both, and the
 * Worker's deploy workflow once it has deployed.
 *
 * Authenticated with `Authorization: Bearer <PAYLOAD_SECRET>`, which the
 * container already holds.
 */
export async function POST(request: Request): Promise<Response> {
  if (!hasPayloadSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload = await getPayloadConfig()
  const docs = await syncRepoDocs(payload)
  revalidatePath("/", "layout")

  purgeEdgeCache(payload.logger, "deploy")
  setTimeout(
    () => purgeEdgeCache(payload.logger, "deploy, after the switchover"),
    DEPLOY_REPURGE_MS,
  ).unref?.()

  return Response.json({
    revalidated: true,
    docs: docs && { created: docs.created, updated: docs.updated },
  })
}
