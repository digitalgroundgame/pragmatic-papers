import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, Payload } from "payload"

import { revalidateTag } from "next/cache"

import { purgeEdgeCache } from "@/hooks/purgeEdgeCache"
import type { InteractiveSnapshot } from "@/payload-types"
import { relationshipId } from "@/utilities/relationships"

import { interactivePaths, interactiveTag } from "../tag"

/**
 * The interactive's page, for the Worker to purge. Null, so the Worker purges every page,
 * when the interactive can't be read.
 */
async function interactivePagePath(
  snapshot: InteractiveSnapshot,
  interactiveId: number | string,
  payload: Payload,
): Promise<string | null> {
  const given = typeof snapshot.interactive === "object" ? snapshot.interactive?.slug : null
  if (given) return interactivePaths(given)[0]!
  try {
    const interactive = await payload.findByID({
      collection: "interactives",
      id: interactiveId,
      depth: 0,
      select: { slug: true },
    })
    return interactive.slug ? interactivePaths(interactive.slug)[0]! : null
  } catch {
    return null
  }
}

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
async function revalidate(snapshot: InteractiveSnapshot, payload: Payload): Promise<void> {
  const interactiveId = relationshipId(snapshot.interactive)
  if (interactiveId == null) return
  revalidateTag(interactiveTag(interactiveId), "max")
  purgeEdgeCache(payload.logger, `interactive ${interactiveId} snapshot`, {
    paths: [await interactivePagePath(snapshot, interactiveId, payload)],
  })
}

export const revalidateSnapshot: CollectionAfterChangeHook<InteractiveSnapshot> = async ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (context.disableRevalidate) return doc
  const wasPublished = previousDoc?._status === "published"
  const isPublished = doc._status === "published"
  if (isPublished || wasPublished) await revalidate(doc, payload)
  return doc
}

export const revalidateSnapshotDelete: CollectionAfterDeleteHook<InteractiveSnapshot> = async ({
  doc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) await revalidate(doc, payload)
  return doc
}
