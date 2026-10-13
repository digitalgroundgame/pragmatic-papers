import type { CollectionBeforeDeleteHook, CollectionSlug } from "payload"

import { COMMENTS_SLUG } from "../constants"

/**
 * Deletes the comments that point at a document before it goes: a comment always has its
 * reader and what it's on, and the database refuses to leave either empty.
 */
export function deleteCommentsOn(field: "reader" | "target"): CollectionBeforeDeleteHook {
  return async ({ id, req }) => {
    await req.payload.delete({
      collection: COMMENTS_SLUG as CollectionSlug,
      where: { [field]: { equals: id } },
      overrideAccess: true,
      req,
    })
  }
}
