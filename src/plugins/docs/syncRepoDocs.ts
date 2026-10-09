import { revalidateTag } from "next/cache"
import type { Payload } from "payload"

import { purgeEdgeCache } from "@/hooks/purgeEdgeCache"

import { DOCS_CACHE_TAG } from "./revalidateDoc"
import { type SyncResult, syncDocs } from "./syncDocs"

/**
 * Writes the repo's docs into this site's database, then drops the cached copies of any it
 * changed, here and at Cloudflare's edge. Run once per deploy, inside the request
 * `/next/revalidate-all` gets when a deploy goes live, not when a server starts: a Worker
 * starts many times, and would cut short a sync left running after its response. Never
 * throws: a failed sync is logged, and the deploy keeps the docs it had.
 */
export async function syncRepoDocs(payload: Payload): Promise<SyncResult | null> {
  if (process.env.DOCS_SYNC === "false") return null
  try {
    const result = await syncDocs(payload)
    if (result.created.length || result.updated.length) {
      const { created, updated } = result
      payload.logger.info({ created, updated }, "Synced help docs from the repo")
      revalidateTag(DOCS_CACHE_TAG, "max")
      purgeEdgeCache(payload.logger, "docs synced")
    }
    return result
  } catch (err) {
    payload.logger.error({ err }, "Syncing help docs failed")
    return null
  }
}
