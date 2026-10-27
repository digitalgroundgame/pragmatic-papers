import type { Payload } from "payload"

import { type SyncResult, syncDocs } from "./syncDocs"

/**
 * Seeds this site's database with the repo's docs it doesn't have yet, as drafts, and leaves the
 * docs it has alone, logging those the repo has changed. Drafts aren't on /docs or in the bell, so
 * nothing is cached to drop: an editor publishing one clears the caches, as any save does. Run
 * once per deploy, inside the request `/next/revalidate-all` gets when a deploy goes live, not
 * when a server starts: a Worker starts many times, and would cut short a sync left running
 * after its response. Never throws: a failed sync is logged, and the deploy keeps the docs it
 * had.
 */
export async function syncRepoDocs(payload: Payload): Promise<SyncResult | null> {
  try {
    const result = await syncDocs(payload)
    if (result.created.length) {
      payload.logger.info({ created: result.created }, "Seeded help docs from the repo as drafts")
    }
    if (result.changed.length) {
      payload.logger.info(
        { changed: result.changed },
        "Left help docs the repo has changed as this site's editors have them",
      )
    }
    return result
  } catch (err) {
    payload.logger.error({ err }, "Syncing help docs failed")
    return null
  }
}
