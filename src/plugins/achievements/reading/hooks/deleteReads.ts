import type { CollectionBeforeDeleteHook, CollectionSlug } from "payload"

import { READS_SLUG } from "../constants"

/** Deleting an account deletes what it read: the history lasts as long as the account. */
export const deleteUsersReads: CollectionBeforeDeleteHook = async ({ id, req }) => {
  await req.payload.delete({
    collection: READS_SLUG as CollectionSlug,
    where: { user: { equals: id } },
    overrideAccess: true,
    req,
  })
}

/** Deleting an article deletes its reads, so nobody keeps credit for a page that's gone. */
export const deleteArticlesReads: CollectionBeforeDeleteHook = async ({ id, req }) => {
  await req.payload.delete({
    collection: READS_SLUG as CollectionSlug,
    where: { article: { equals: id } },
    overrideAccess: true,
    req,
  })
}
