// The Cloudflare Worker's entry (`main` in wrangler.jsonc): OpenNext's worker, built into
// `.open-next/` by `pnpm build:worker`, behind `withOrigin`.
//
// Two entrypoints serve it. `CachedSite` has Workers Cache switched on (`exports` in
// wrangler.jsonc); the default one is the uncached gateway in front of it, which sends it
// only what the cache may hold (`edgeCache.ts`).
import { WorkerEntrypoint } from "cloudflare:workers"

import openNext from "../../.open-next/worker.js"
import { afterCachedSite, withEdgeCache } from "./edgeCache"
import { logErrorCauses, withOrigin } from "./origin"

export { DOQueueHandler } from "../../.open-next/worker.js"

logErrorCauses()

const site = withOrigin(openNext)

export class CachedSite extends WorkerEntrypoint {
  // A .mjs file can't carry the types; afterCachedSite's are checked in edgeCache.ts.
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async fetch(request) {
    const response = await site.fetch(request, this.env, this.ctx)
    return afterCachedSite(request, response, this.ctx.cache)
  }
}

export default withEdgeCache(site)
