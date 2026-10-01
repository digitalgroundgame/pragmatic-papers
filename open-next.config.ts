// #916 spike: OpenNext for Cloudflare. Starts from the package's template
// (node_modules/@opennextjs/cloudflare/templates/open-next.config.ts).
import { defineCloudflareConfig } from "@opennextjs/cloudflare"
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache"

export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
})
