import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, Payload } from "payload"

import { revalidateTag } from "next/cache"

import { readersChange } from "@/utilities/readersCopy"

import { purgeEdgeCache } from "./purgeEdgeCache"

/**
 * The Header and Footer globals' nav links can point at a page, article, volume or topic
 * (`relationTo` in `src/fields/link.ts`). `getGlobal` caches each global with the
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

export const revalidateNavLinks: CollectionAfterChangeHook = async (args) => {
  const { collection, doc, operation, req } = args
  if (req.context.disableRevalidate || operation === "create") return doc
  // Compared as readers see it: an autosave over a published document changes nothing
  // the nav shows, and its publish is compared with the copy readers had before.
  const change = await readersChange(args)
  if (!change) return doc
  const { before, after } = change
  if (!before || !after || before.slug !== after.slug) {
    revalidateNav(req.payload.logger, `${collection.slug} ${before?.slug ?? after?.slug} changed`)
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
