import type { TaskConfig } from "payload"

import { revalidatePath, revalidateTag } from "next/cache"

import { interactivePath, interactiveTag } from "@/collections/InteractiveSnapshots/tag"

import { syncInteractive, type SyncOutcome } from "./logic"

/**
 * Pull every interactive's data feed into `interactive-snapshots`.
 *
 * Once a day. A researcher's tracker changes a few times a month, and each run that finds
 * nothing costs one small request (the upstream manifest) per interactive. What needs to be
 * prompt — "I just pushed the new appointments, get them on the site" — is the "run now"
 * endpoint on Interactive Snapshots, which runs this same task immediately.
 *
 * A run writes drafts unless the interactive is set to auto-publish, so the schedule never
 * changes what readers see on its own; an editor does, by publishing the snapshot.
 */
export const syncInteractiveDataTask: TaskConfig<"syncInteractiveData"> = {
  slug: "syncInteractiveData",
  label: "Sync Interactive Data Feeds",
  retries: { attempts: 2, backoff: { type: "exponential", delay: 60_000 } },
  schedule: [
    {
      // 06:15 UTC — after a US-evening data push, before a US-morning editorial pass.
      cron: "15 6 * * *",
      queue: "default",
    },
  ],
  inputSchema: [
    { name: "interactiveId", type: "number" },
    { name: "force", type: "checkbox" },
  ],
  outputSchema: [
    { name: "synced", type: "number", required: true },
    { name: "unchanged", type: "number", required: true },
    { name: "skipped", type: "number", required: true },
    { name: "failed", type: "number", required: true },
  ],
  handler: async ({ input, req }) => {
    const { payload } = req
    const log = payload.logger
    const startedAt = Date.now()
    const counts = { synced: 0, unchanged: 0, skipped: 0, failed: 0 }
    const interactiveId = typeof input?.interactiveId === "number" ? input.interactiveId : null
    const force = input?.force === true

    log.info(
      `[interactive-sync] === starting${interactiveId ? ` for interactive ${interactiveId}` : ""}${force ? " (forced)" : ""} ===`,
    )

    const { docs: interactives } = await payload.find({
      collection: "interactives",
      where: interactiveId ? { id: { equals: interactiveId } } : {},
      // Drafts too: a not-yet-published interactive still wants its data ready for preview.
      draft: true,
      limit: 0,
      depth: 0,
      overrideAccess: true,
    })

    for (const interactive of interactives) {
      let outcome: SyncOutcome
      try {
        outcome = await syncInteractive(payload, interactive, { log, force })
      } catch (err) {
        // A network error on one feed must not stop the next interactive's sync.
        const message = err instanceof Error ? err.message : String(err)
        log.error(`[interactive-sync:${interactive.slug}] ${message}`)
        outcome = { outcome: "failed", errors: [message] }
      }
      counts[outcome.outcome] += 1
      if (outcome.outcome === "synced" && outcome.status === "published") {
        try {
          revalidateTag(interactiveTag(interactive.id), "max")
          if (interactive.slug) revalidatePath(interactivePath(interactive.slug))
        } catch (err) {
          // Same caveat as the merch sync: revalidation wants a request scope and the
          // scheduled run has none. The snapshot is written; the cache catches up on the
          // next editorial save or the next request after the page's revalidate window.
          log.warn(
            `[interactive-sync:${interactive.slug}] published but revalidation failed: ${err instanceof Error ? err.message : String(err)}`,
          )
        }
      }
    }

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
    log.info(
      `[interactive-sync] === done — ${counts.synced} synced, ${counts.unchanged} unchanged, ${counts.skipped} skipped, ${counts.failed} failed in ${elapsed}s ===`,
    )
    return { output: counts }
  },
}
