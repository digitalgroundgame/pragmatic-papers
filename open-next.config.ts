// OpenNext for the Cloudflare Worker build (src/cloudflare/README.md). Starts from the
// package's template (node_modules/@opennextjs/cloudflare/templates/open-next.config.ts).
import { defineCloudflareConfig } from "@opennextjs/cloudflare"
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache"
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue"
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache"

export default defineCloudflareConfig({
  // Pages that prerender or revalidate, keyed by route, so a client-side navigation reads
  // the same entry whichever page it came from.
  incrementalCache: r2IncrementalCache,
  // Re-renders a page whose `revalidate` time has passed, in a Durable Object, while the
  // stale copy is served.
  queue: doQueue,
  // When `revalidatePath` / `revalidateTag` last ran for each path and tag, so the
  // revalidate-all call after a deploy throws away what the build prerendered.
  tagCache: d1NextTagCache,
  // Answers cached pages before loading Next's server code.
  enableCacheInterception: true,
})
