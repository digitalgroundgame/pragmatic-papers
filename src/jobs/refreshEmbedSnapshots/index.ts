import type { TaskConfig } from "payload"

import { refreshEmbedSnapshots } from "./logic"

/**
 * Re-fetch social embeds whose snapshot is older than its TTL (30 days), so a post deleted or
 * made private after the article was published falls back to its saved markup instead of
 * loading the platform's script. It writes only `embed-snapshots`; article pages pick the new
 * snapshot up when they next regenerate (within the hour).
 */
export const refreshEmbedSnapshotsTask: TaskConfig<"refreshEmbedSnapshots"> = {
  slug: "refreshEmbedSnapshots",
  label: "Refresh Social Embed Snapshots",
  retries: { attempts: 2, backoff: { type: "exponential", delay: 60_000 } },
  schedule: [{ cron: "45 5 * * *", queue: "default" }],
  outputSchema: [
    { name: "refreshed", type: "number", required: true },
    { name: "fresh", type: "number", required: true },
    { name: "failed", type: "number", required: true },
  ],
  handler: async ({ req }) => {
    const log = req.payload.logger
    const counts = await refreshEmbedSnapshots(req.payload, { log })
    log.info(
      `[embed-refresh] done: ${counts.refreshed} refreshed, ${counts.fresh} fresh, ${counts.failed} failed`,
    )
    return { output: counts }
  },
}
