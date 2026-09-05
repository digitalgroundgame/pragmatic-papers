import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from "payload"

import { revalidatePath, revalidateTag } from "next/cache"

import { interactivePath, interactiveTag } from "@/collections/InteractiveSnapshots/tag"
import type { Interactive } from "@/payload-types"

export const revalidateInteractive: CollectionAfterChangeHook<Interactive> = ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (context.disableRevalidate) return doc
  if (doc._status === "published") {
    const path = interactivePath(doc.slug ?? "")
    payload.logger.info(`Revalidating interactive at path: ${path}`)
    revalidatePath(path)
    revalidateTag(interactiveTag(doc.id), "max")
  }
  // Unpublished, or the slug moved: the old path must stop serving the old page.
  if (
    previousDoc?._status === "published" &&
    (doc._status !== "published" || previousDoc.slug !== doc.slug)
  ) {
    const oldPath = interactivePath(previousDoc.slug ?? "")
    payload.logger.info(`Revalidating old interactive at path: ${oldPath}`)
    revalidatePath(oldPath)
    revalidateTag(interactiveTag(doc.id), "max")
  }
  return doc
}

export const revalidateInteractiveDelete: CollectionAfterDeleteHook<Interactive> = ({
  doc,
  req: { context },
}) => {
  if (!context.disableRevalidate) {
    revalidatePath(interactivePath(doc?.slug ?? ""))
    revalidateTag(interactiveTag(doc.id), "max")
  }
  return doc
}
