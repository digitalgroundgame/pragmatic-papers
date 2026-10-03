import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, Payload } from "payload"

import { revalidateTag } from "next/cache"

import { purgeEdgeCache } from "./purgeEdgeCache"

/**
 * The Header and Footer globals' nav links can point at a page, article, volume or topic
 * (`relationTo` in `src/fields/link2.ts`). `getCachedGlobal` caches each global with the
 * linked documents populated, and builds every href from the cached `slug`, so renaming,
 * unpublishing or deleting a linked document would leave the nav pointing at a 404 until
 * someone re-saved the global.
 *
 * These hooks drop both globals' caches when a document a link could point at changes in a
 * way the nav would show: its slug, or whether it's published. A link's label is its own
 * field, so a title change doesn't reach the nav and doesn't revalidate it.
 *
 * `{ expire: 0 }` rather than `"max"`: with `"max"` the next reader gets the stale nav while
 * it refreshes, and Cloudflare would cache that copy for another 10 minutes right after
 * `purgeEdgeCache` emptied it.
 */
const NAV_TAGS = ["global_header", "global_footer"] as const

interface NavTarget {
  slug?: string | null
  _status?: "draft" | "published" | null
}

function revalidateNav(logger: Payload["logger"], reason: string): void {
  logger.info(`Revalidating header and footer nav (${reason})`)
  try {
    for (const tag of NAV_TAGS) revalidateTag(tag, { expire: 0 })
  } catch (err) {
    // `revalidateTag` needs a Next request scope. A Local API write from a script or a job
    // has none, and failing that write over the nav's cache would be worse than a stale nav.
    logger.warn(
      `Couldn't revalidate the nav (${reason}): ${err instanceof Error ? err.message : String(err)}`,
    )
  }
  purgeEdgeCache(logger, reason)
}

/** Whether a reader could have seen it: published, or in a collection without drafts. */
const visible = (doc?: NavTarget | null): boolean =>
  doc != null && (doc._status === undefined || doc._status === null || doc._status === "published")

export const revalidateNavLinks: CollectionAfterChangeHook = ({
  collection,
  doc,
  previousDoc,
  operation,
  req: { payload, context },
}) => {
  if (context.disableRevalidate || operation === "create") return doc
  const next = doc as NavTarget
  const prev = previousDoc as NavTarget | undefined
  if (!prev) return doc

  const wasVisible = visible(prev)
  const isVisible = visible(next)
  // A draft of something never published can't be in the nav's cached copy in any form a
  // reader sees, so its edits change nothing.
  if (!wasVisible && !isVisible) return doc

  if (wasVisible !== isVisible || prev.slug !== next.slug) {
    revalidateNav(payload.logger, `${collection.slug} ${prev.slug ?? next.slug} changed`)
  }
  return doc
}

export const revalidateNavLinksDelete: CollectionAfterDeleteHook = ({
  collection,
  doc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    revalidateNav(payload.logger, `${collection.slug} ${(doc as NavTarget).slug} deleted`)
  }
  return doc
}
