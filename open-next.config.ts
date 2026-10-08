// OpenNext for the Cloudflare Worker build (src/cloudflare/README.md). Starts from the
// package's template (node_modules/@opennextjs/cloudflare/templates/open-next.config.ts).
// Pages that prerender or revalidate are cached in R2, keyed by route, so a client-side
// navigation reads the same entry whichever page it came from.
import { defineCloudflareConfig } from "@opennextjs/cloudflare"
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache"

export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
})
