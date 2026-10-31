import type { CollectionBeforeDeleteHook, CollectionSlug } from "payload"

import { COMMENTS_SLUG } from "../constants"

/** Deletes a comment's replies before it goes, and theirs, so no reply is left hanging. */
export const deleteReplies: CollectionBeforeDeleteHook = async ({ id, req }) => {
  await req.payload.delete({
    collection: COMMENTS_SLUG as CollectionSlug,
    where: { parent: { equals: id } },
    overrideAccess: true,
    req,
  })
}
