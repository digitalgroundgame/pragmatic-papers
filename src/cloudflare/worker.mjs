// The Cloudflare Worker's entry (`main` in wrangler.jsonc): OpenNext's worker, built into
// `.open-next/` by `pnpm build:worker`, behind `withOrigin`.
//
// Two entrypoints serve it. `CachedSite` has Workers Cache switched on (`exports` in
// wrangler.jsonc); the default one is the uncached gateway in front of it, which sends it
// only what the cache may hold (`edgeCache.ts`). Each reports its errors to Sentry when the
// Worker has a SENTRY_DSN (`sentry.ts`).
import { withSentry } from "@sentry/cloudflare"
import { WorkerEntrypoint } from "cloudflare:workers"

import openNext from "../../.open-next/worker.js"
import { afterCachedSite, withEdgeCache, withServerTiming } from "./edgeCache"
import { logErrorCauses, withOrigin } from "./origin"
import { workerSentryOptions } from "./sentry"

export { DOQueueHandler } from "../../.open-next/worker.js"

logErrorCauses()

const site = withOrigin(openNext)

class CachedSiteEntrypoint extends WorkerEntrypoint {
  // A .mjs file can't carry the types; afterCachedSite's and withServerTiming's are checked in edgeCache.ts.
  async fetch(request) {
    const startedAt = Date.now()
    const response = await site.fetch(request, this.env, this.ctx)
    const answer = await afterCachedSite(request, response, this.ctx.cache)
    return withServerTiming(request, answer, startedAt)
  }
}

export const CachedSite = withSentry(workerSentryOptions, CachedSiteEntrypoint)

export default withSentry(workerSentryOptions, withEdgeCache(site))
