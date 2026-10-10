import type { Payload } from "payload"

import {
  cloudflareCache,
  cloudflareWorkerCache,
  describeStatus,
  integrationStatus,
} from "@/integrations"
import { getSiteURL } from "@/utilities/getURL"

type Logger = Pick<Payload["logger"], "info" | "warn">

/**
 * How long to gather purges before sending one. A publish runs several hooks (the document's
 * own, then any it touches), and Cloudflare's hostname purges are rate-limited per account
 * (5 a minute on the Free plan), so a burst of saves becomes a single request.
 */
export const PURGE_DEBOUNCE_MS = 1000

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"])

let pending: { reasons: Set<string>; logger: Logger; timer: ReturnType<typeof setTimeout> } | null =
  null
let inFlight: Promise<void> = Promise.resolve()

/** This deployment's public hostname, or null when it isn't one Cloudflare could be fronting. */
function siteHost(): string | null {
  try {
    const host = new URL(getSiteURL()).hostname
    return LOCAL_HOSTS.has(host) || host.endsWith(".localhost") ? null : host
  } catch {
    return null
  }
}

/** Why the edge can't be purged right now, or null when it can. */
function edgeSkipReason(): string | null {
  const status = integrationStatus(cloudflareCache)
  if (!status.configured) return describeStatus(status)
  if (!siteHost()) return "SERVER_URL is not a public hostname"
  return null
}

async function revalidateWorker(logger: Logger, why: string): Promise<void> {
  try {
    await cloudflareWorkerCache.revalidateAll()
    logger.info(`Cleared the Worker's cache at ${cloudflareWorkerCache.url()} (${why})`)
  } catch (err) {
    logger.warn(
      `Clearing the Worker's cache at ${cloudflareWorkerCache.url()} failed (${why}): ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

async function purgeEdge(logger: Logger, why: string, host: string): Promise<void> {
  try {
    await cloudflareCache.purge({ hosts: [host] })
    logger.info(`Purged Cloudflare's cache for ${host} (${why})`)
  } catch (err) {
    // Never thrown at a save: the change is in the database and at the origin already, and
    // the edge catches up on its own within the page's s-maxage.
    logger.warn(
      `Cloudflare purge for ${host} failed (${why}): ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

async function flush(): Promise<void> {
  if (!pending) return
  const { reasons, logger } = pending
  pending = null
  const why = [...reasons].join(", ")
  // The Worker first: once the edge is empty it refills from whatever the Worker answers.
  if (integrationStatus(cloudflareWorkerCache).configured) await revalidateWorker(logger, why)
  const host = siteHost()
  if (host && !edgeSkipReason()) await purgeEdge(logger, why, host)
}

/**
 * Drop this deployment's pages from Cloudflare's edge cache, so anonymous readers see a save
 * now rather than when the edge's copy expires (`s-maxage=600`, then up to a day of
 * `stale-while-revalidate`, from the public-page rule in `next.config.ts`).
 *
 * Purges the whole hostname, not the saved document's own URLs. A save shows up in listings,
 * feeds, sitemaps and on every page (the nav), more places than a hook can name. The hostname
 * keeps it to this environment: production, staging and the PR previews share one zone, so a
 * "purge everything" from a preview would empty production's cache.
 *
 * Fire-and-forget: it returns at once, and the request goes out after `PURGE_DEBOUNCE_MS`,
 * so a slow Cloudflare API never holds up the editor's save. Call it from a `revalidate*` hook
 * after Next's own revalidation, and only when `context.disableRevalidate` is unset.
 *
 * When the deployment has a Cloudflare Worker serving its pages (`cloudflareWorkerCache`), the
 * same flush clears the Worker's cache first, through its `/next/revalidate-all`: the Worker
 * keeps its own copy of every prerendered page, which neither Next's revalidation here nor the
 * edge purge reaches.
 *
 * With neither connection configured (local dev, CI, anything not behind Cloudflare) it logs
 * the missing variables by name and does nothing.
 */
export function purgeEdgeCache(logger: Logger, reason: string): void {
  const edgeSkip = edgeSkipReason()
  const worker = integrationStatus(cloudflareWorkerCache)
  if (edgeSkip && !worker.configured) {
    logger.info(`Skipping Cloudflare purge (${reason}) — ${edgeSkip}`)
    return
  }

  if (pending) {
    pending.reasons.add(reason)
    return
  }
  pending = {
    reasons: new Set([reason]),
    logger,
    timer: setTimeout(() => {
      inFlight = inFlight.then(flush)
    }, PURGE_DEBOUNCE_MS),
  }
  // Don't keep a CLI script (a seed, a migration) alive for a purge.
  pending.timer.unref?.()
}

/** Tests only: send any gathered purge now and wait for it. */
export async function flushEdgeCachePurge(): Promise<void> {
  if (pending) {
    clearTimeout(pending.timer)
    inFlight = inFlight.then(flush)
  }
  await inFlight
}
