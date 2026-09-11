import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from "payload"

import { revalidateTag } from "next/cache"

import { interactiveTag } from "@/collections/InteractiveSnapshots/tag"
import type { Interactive } from "@/payload-types"

// No revalidatePath here: /interactives/[slug] calls draftMode(), so it is always rendered
// per-request (Next never gives it a Full Route Cache entry to purge). revalidatePath on a
// route like that forces Next to regenerate it outside of any real request — no cookies, no
// draftMode() — which throws DynamicServerError (digest DYNAMIC_SERVER_USAGE) and surfaces as
// a crash to whichever visitor's request lands during that regeneration. revalidateTag is the
// only invalidation this page's data actually needs (see loadInteractiveOverview's unstable_cache).
export const revalidateInteractive: CollectionAfterChangeHook<Interactive> = ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (context.disableRevalidate) return doc
  if (doc._status === "published") {
    payload.logger.info(`Revalidating interactive: ${doc.slug}`)
    revalidateTag(interactiveTag(doc.id), "max")
    revalidateTag("interactives-sitemap", "max")
  }
  // Unpublished, or the slug moved: the sitemap must stop naming it (or must name the new
  // slug instead).
  if (
    previousDoc?._status === "published" &&
    (doc._status !== "published" || previousDoc.slug !== doc.slug)
  ) {
    payload.logger.info(`Revalidating old interactive: ${previousDoc.slug}`)
    revalidateTag(interactiveTag(doc.id), "max")
    revalidateTag("interactives-sitemap", "max")
  }
  return doc
}

export const revalidateInteractiveDelete: CollectionAfterDeleteHook<Interactive> = ({
  doc,
  req: { context },
}) => {
  if (!context.disableRevalidate) {
    revalidateTag(interactiveTag(doc.id), "max")
    revalidateTag("interactives-sitemap", "max")
  }
  return doc
}
