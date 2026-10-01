import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, Payload } from "payload"

import { revalidateTag } from "next/cache"

import { purgeEdgeCache } from "@/hooks/purgeEdgeCache"
import type { InteractiveSnapshot } from "@/payload-types"
import { relationshipId } from "@/utilities/relationships"

import { interactiveTag } from "../tag"

/**
 * A snapshot reaches readers only when published, so that is the only transition worth
 * dropping caches for: a new published version, or a published one being unpublished.
 * Drafts written by the sync change nothing a reader sees.
 *
 * No revalidatePath: /interactives/[slug] calls draftMode(), so it's always rendered
 * per-request and never holds a Full Route Cache entry to purge. Forcing a regeneration of
 * it outside a real request throws DynamicServerError (no cookies to read draftMode from),
 * which surfaces as a crash to whichever visitor's request lands during that regeneration.
 */
function revalidate(snapshot: InteractiveSnapshot, logger: Payload["logger"]): void {
  const interactiveId = relationshipId(snapshot.interactive)
  if (interactiveId == null) return
  revalidateTag(interactiveTag(interactiveId), "max")
  purgeEdgeCache(logger, `interactive ${interactiveId} snapshot`)
}

export const revalidateSnapshot: CollectionAfterChangeHook<InteractiveSnapshot> = ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (context.disableRevalidate) return doc
  const wasPublished = previousDoc?._status === "published"
  const isPublished = doc._status === "published"
  if (isPublished || wasPublished) revalidate(doc, payload.logger)
  return doc
}

export const revalidateSnapshotDelete: CollectionAfterDeleteHook<InteractiveSnapshot> = ({
  doc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) revalidate(doc, payload.logger)
  return doc
}
