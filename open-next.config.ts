// OpenNext for the Cloudflare Worker build (src/cloudflare/README.md). Starts from the
// package's template (node_modules/@opennextjs/cloudflare/templates/open-next.config.ts).
import { defineCloudflareConfig } from "@opennextjs/cloudflare"
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache"
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue"
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache"

const config = defineCloudflareConfig({
  // Pages that prerender or revalidate, keyed by route, so a client-side navigation reads
  // the same entry whichever page it came from.
  incrementalCache: r2IncrementalCache,
  // Re-renders a page whose `revalidate` time has passed, in a Durable Object, while the
  // stale copy is served. The Durable Object is the queue Worker's (queue.wrangler.jsonc), so
  // the site's Worker keeps its Version URLs.
  queue: doQueue,
  // When `revalidatePath` / `revalidateTag` last ran for each path and tag, so the
  // revalidate-all call after a deploy throws away what the build prerendered.
  tagCache: d1NextTagCache,
  // Answers cached pages before loading Next's server code.
  enableCacheInterception: true,
})

// Sends a request from a page an earlier deploy built (its `x-deployment-id` header or
// `dpl` query: Next's `deploymentId`, which worker.yml sets per run through
// NEXT_DEPLOYMENT_ID) to that deploy's Version URL, so a tab opened before a deploy keeps
// loading its own chunks and Server Functions. Only on the site's own hostnames: workers.dev
// and localhost skip it. `opennextjs-cloudflare deploy` records which version each deploy
// is (CF_DEPLOYMENT_MAPPING), with CF_WORKERS_SCRIPTS_API_TOKEN and CF_ACCOUNT_ID.
config.cloudflare = { ...config.cloudflare, skewProtection: { enabled: true } }

export default config
