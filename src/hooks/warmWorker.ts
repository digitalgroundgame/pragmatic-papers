import type { Payload } from "payload"

import { cloudflareWorkerCache } from "@/integrations"

import { PURGE_SETTLE_MS, warmPages, type WarmOptions } from "./warmPages"

type Logger = Pick<Payload["logger"], "info" | "warn">
type WarmPayload = Pick<Payload, "find"> & { logger: Logger }

/**
 * Request the most-read pages through the Worker's URL (`cloudflareWorkerCache`), once its
 * cache has been cleared, so readers find them in its edge cache. A page the Worker renders on
 * a cold isolate takes seconds; warmed, every data center can answer it from the cache's
 * upper tier. Does nothing when the Worker's URL isn't set. Never throws.
 */
export async function warmWorker(
  payload: WarmPayload,
  { fetchImpl }: Pick<WarmOptions, "fetchImpl"> = {},
): Promise<void> {
  const baseURL = cloudflareWorkerCache.url()
  if (!baseURL) return
  await warmPages(payload, { fetchImpl, baseURL, occasion: "on the Worker" })
}

async function loadPayload(): Promise<WarmPayload> {
  // Imported here: the hooks that clear the Worker are part of the Payload config this loads.
  const { getPayloadClient } = await import("@/data/payload")
  return getPayloadClient()
}

let running: Promise<void> | null = null
let again = false

async function warmUntilSettled(logger: Logger): Promise<void> {
  do {
    again = false
    await new Promise((resolve) => setTimeout(resolve, PURGE_SETTLE_MS))
    try {
      await warmWorker(await loadPayload())
    } catch (err) {
      logger.warn(
        `Couldn't warm the Worker's pages: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  } while (again)
}

/**
 * Warm the Worker's pages in the background, once its purge has had time to reach every data
 * center. A save that clears the Worker while a warm-up is running gets one more warm-up after
 * it, since the purge threw away what it had warmed; more saves in that time add no more.
 */
export function warmWorkerSoon(logger: Logger): void {
  if (running) {
    again = true
    return
  }
  running = warmUntilSettled(logger).finally(() => {
    running = null
  })
}

/** Wait for a background warm-up to finish, for tests. */
export async function workerWarmed(): Promise<void> {
  await running
}
