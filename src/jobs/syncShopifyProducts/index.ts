import type { TaskConfig } from "payload"

import { revalidateTag } from "next/cache"

import { MERCH_TAG } from "@/collections/Merch/tag"
import {
  didChange,
  fetchShopifyProducts,
  readShopifyEnv,
  storefrontEndpoint,
  syncBlockedReason,
  syncProducts,
} from "./logic"

/**
 * Pull the Shopify catalogue into `merch` so Merch blocks render
 * live prices and availability instead of hand-typed rows.
 *
 * Every six hours, which is a catch-up pass rather than a freshness
 * guarantee. A catalogue that turns over a few times a season doesn't earn
 * more: each run re-stamps `lastSyncedAt` on every row it sees, so polling
 * costs a write per product whether or not the store changed anything.
 *
 * What actually needs to be prompt is a drop the editor just pushed, and the
 * "run now" endpoint (`/merch/sync`) serves that directly — no schedule can
 * beat a button. The window this leaves is a product selling out between
 * runs, where the card shows an unsold badge for a few hours and the store
 * site corrects it on the click through.
 *
 * It only writes on a deployed site. `payload.config.ts` auto-runs the jobs queue every five
 * minutes everywhere, `pnpm dev` and the test servers included, and a run replaces `merch`
 * with the live catalogue, archiving every seeded product the store doesn't list. So a run
 * is a logged no-op unless `BUILD_ENV` names a deploy (`syncBlockedReason`), and then
 * unless the Shopify credentials are set: having the store token in a local `.env` isn't
 * enough to sync there.
 */
export const syncShopifyProductsTask: TaskConfig<"syncShopifyProducts"> = {
  slug: "syncShopifyProducts",
  label: "Sync Shopify Merch Products",
  retries: { attempts: 2, backoff: { type: "exponential", delay: 60_000 } },
  schedule: [
    {
      // 00:00, 06:00, 12:00 and 18:00 UTC.
      cron: "0 */6 * * *",
      queue: "default",
    },
  ],
  outputSchema: [
    { name: "created", type: "number", required: true },
    { name: "updated", type: "number", required: true },
    { name: "archived", type: "number", required: true },
    { name: "unchanged", type: "number", required: true },
  ],
  handler: async ({ req }) => {
    const { payload } = req
    const log = payload.logger
    const startedAt = Date.now()
    const empty = { created: 0, updated: 0, archived: 0, unchanged: 0 }

    log.info("[merch-sync] === starting Shopify product sync ===")

    const blocked = syncBlockedReason()
    if (blocked) {
      log.warn(`[merch-sync] ${blocked} — skipping run`)
      return { output: empty }
    }

    const config = readShopifyEnv()
    if (!config) {
      // A deploy without store credentials (a preview, say). Skipping is the
      // correct outcome — whatever rows it has stay put and the carousel keeps
      // rendering.
      log.warn(
        "[merch-sync] SHOPIFY_STORE_DOMAIN / SHOPIFY_STOREFRONT_ACCESS_TOKEN / SHOPIFY_API_VERSION missing or unparseable — skipping run",
      )
      return { output: empty }
    }

    log.debug(`[merch-sync] step 1/3: fetching catalogue from ${storefrontEndpoint(config)}`)
    const nodes = await fetchShopifyProducts(config, log)
    log.debug(`[merch-sync]   fetched ${nodes.length} products`)

    log.debug("[merch-sync] step 2/3: upserting products and archiving delistings")
    const syncedAt = new Date().toISOString()
    const counts = await syncProducts(payload, nodes, syncedAt, log)

    log.debug("[merch-sync] step 3/3: revalidating cached product queries")
    if (didChange(counts)) {
      try {
        revalidateTag(MERCH_TAG, "max")
        log.debug("[merch-sync]   catalogue changed — dropped the merch cache")
      } catch (err) {
        // `revalidateTag` wants a request scope, and the scheduled run happens
        // on a background timer. A stale cache until the next editorial save is
        // survivable; failing the whole sync over it is not, since the rows are
        // already written by this point.
        log.warn(
          `[merch-sync]   catalog changed but revalidation failed: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    } else {
      // Revalidating on every run would drop every page embedding a Merch
      // block, on a schedule, to render byte-identical output.
      log.debug("[merch-sync]   nothing changed — left the cache alone")
    }

    const elapsedMs = Date.now() - startedAt
    log.info(
      `[merch-sync] === done — ${counts.created} created, ${counts.updated} updated, ${counts.archived} archived, ${counts.unchanged} unchanged in ${(elapsedMs / 1000).toFixed(1)}s ===`,
    )

    return { output: counts }
  },
}
