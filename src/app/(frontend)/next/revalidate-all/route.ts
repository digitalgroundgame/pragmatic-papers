import { revalidatePath } from "next/cache"

import { syncRepoDocs } from "@/plugins/docs/syncRepoDocs"
import { getPayloadConfig } from "@/utilities/getPayloadConfig"

import { hasPayloadSecret } from "../bearer"

/**
 * Run once each time a deploy goes live. Writes the help docs in src/docs/ into this
 * deployment's database (`syncRepoDocs`), then throws away every page and route Next.js
 * prerendered at build time, so each renders again from that database on its next request.
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

  const docs = await syncRepoDocs(await getPayloadConfig())
  revalidatePath("/", "layout")

  return Response.json({
    revalidated: true,
    docs: docs && { created: docs.created, updated: docs.updated },
  })
}
