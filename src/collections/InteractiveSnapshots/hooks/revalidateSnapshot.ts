import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from "payload"

import { revalidatePath, revalidateTag } from "next/cache"

import type { InteractiveSnapshot } from "@/payload-types"
import { relationshipId } from "@/utilities/relationships"

import { interactivePath, interactiveTag } from "../tag"

/**
 * A snapshot reaches readers only when published, so that is the only transition worth
 * dropping caches for: a new published version, or a published one being unpublished.
 * Drafts written by the sync change nothing a reader sees.
 */
async function revalidate(
  snapshot: InteractiveSnapshot,
  payload: Parameters<CollectionAfterChangeHook>[0]["req"]["payload"],
): Promise<void> {
  const interactiveId = relationshipId(snapshot.interactive)
  if (interactiveId == null) return
  revalidateTag(interactiveTag(interactiveId), "max")
  try {
    const interactive = await payload.findByID({
      collection: "interactives",
      id: interactiveId,
      depth: 0,
      overrideAccess: true,
    })
    if (interactive?.slug) revalidatePath(interactivePath(interactive.slug))
  } catch (err) {
    payload.logger.warn(
      `[interactives] snapshot changed but could not resolve its page path: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

export const revalidateSnapshot: CollectionAfterChangeHook<InteractiveSnapshot> = async ({
  doc,
  previousDoc,
  req: { context, payload },
}) => {
  if (context.disableRevalidate) return doc
  const wasPublished = previousDoc?._status === "published"
  const isPublished = doc._status === "published"
  if (isPublished || wasPublished) await revalidate(doc, payload)
  return doc
}

export const revalidateSnapshotDelete: CollectionAfterDeleteHook<InteractiveSnapshot> = async ({
  doc,
  req: { context, payload },
}) => {
  if (!context.disableRevalidate) await revalidate(doc, payload)
  return doc
}
