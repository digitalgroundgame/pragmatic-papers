import type { TaskConfig } from "payload"
import {
  buildCandidatesFromDB,
  createAnalyticsClient,
  DATE_RANGE_START,
  fetchGA4Metrics,
  MAX_RANKINGS,
  MIN_TOTAL_USERS,
  readGA4Env,
  scoreArticles,
  seedRandomRankings,
  writeRankings,
} from "./logic"

export const updateRecommendationsTask: TaskConfig<"updateRecommendations"> = {
  slug: "updateRecommendations",
  label: "Update Article Recommendations",
  retries: { attempts: 2, backoff: { type: "exponential", delay: 60_000 } },
  schedule: [
    {
      // Twice an hour (on the hour and at minute 30)
      cron: "0,30 * * * *",
      queue: "default",
    },
  ],
  outputSchema: [{ name: "count", type: "number", required: true }],
  handler: async ({ req }) => {
    const { payload } = req
    const log = payload.logger
    const startedAt = Date.now()
    log.info("[recommendations] === starting update run ===")

    if (process.env.NODE_ENV !== "production") {
      log.info(
        "[recommendations] non-production environment — seeding random rankings instead of querying GA4",
      )
      const count = await seedRandomRankings(payload)
      const elapsedMs = Date.now() - startedAt
      log.info(
        `[recommendations] === done — seeded ${count} random rankings in ${(elapsedMs / 1000).toFixed(1)}s ===`,
      )
      return { output: { count } }
    }

    log.debug("[recommendations] step 1/5: reading GA4 credentials from env")
    const { propertyId, clientEmail, privateKey } = readGA4Env()
    log.debug(
      `[recommendations]   GA4 property=${propertyId}, service account=${clientEmail}, private key length=${privateKey.length}`,
    )
    const analytics = createAnalyticsClient(clientEmail, privateKey)

    log.debug(
      `[recommendations] step 2/5: fetching pageview metrics from GA4 (range ${DATE_RANGE_START} → today)`,
    )
    const metricsBySlug = await fetchGA4Metrics(analytics, propertyId)

    log.debug(
      `[recommendations]   GA4 returned metrics for ${metricsBySlug.size} unique article slugs`,
    )

    log.debug("[recommendations] step 3/5: matching slugs to articles in Payload")
    const candidates = await buildCandidatesFromDB(payload, metricsBySlug, log)
    const latestVolumeCount = candidates.filter((c) => c.isLatestVolume).length
    log.debug(
      `[recommendations]   built ${candidates.length} candidates (${latestVolumeCount} from the latest volume — exempt from the ${MIN_TOTAL_USERS}-user minimum)`,
    )

    log.debug(
      "[recommendations] step 4/5: scoring candidates as scrollRate × exp(-λ·weeksSincePublish)",
    )
    const scored = scoreArticles(candidates, Date.now())
    log.debug(
      `[recommendations]   ${scored.length} of ${candidates.length} candidates passed the user threshold and were scored`,
    )
    log.debug(
      `[recommendations] step 5/5: writing top ${MAX_RANKINGS} rankings to the article-recommendations global`,
    )
    const { count } = await writeRankings(payload, scored, log)

    const elapsedMs = Date.now() - startedAt
    log.info(
      `[recommendations] === done — wrote ${count} rankings in ${(elapsedMs / 1000).toFixed(1)}s ===`,
    )
    return { output: { count } }
  },
}
