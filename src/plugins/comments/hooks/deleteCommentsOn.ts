import type { CollectionBeforeDeleteHook, CollectionSlug } from "payload"

import { COMMENTS_SLUG, VIOLATIONS_SLUG } from "../constants"
import { SKIP_MODERATION } from "./recordModeration"

/** Deletes a document's comments, and their replies, before it goes. */
export const deleteCommentsOnTarget: CollectionBeforeDeleteHook = async ({ id, req }) => {
  await req.payload.delete({
    collection: COMMENTS_SLUG as CollectionSlug,
    where: { target: { equals: id } },
    overrideAccess: true,
    req,
  })
}

/**
 * Before an author's account goes: their words go, and their violations. Their comments stay
 * as `deleted`, empty and with no author, so other people's replies to them keep their place.
 */
export const deleteAuthorsComments: CollectionBeforeDeleteHook = async ({ id, req }) => {
  await req.payload.update({
    collection: COMMENTS_SLUG as CollectionSlug,
    where: { author: { equals: id } },
    data: { body: "", status: "deleted", author: null } as never,
    overrideAccess: true,
    context: { [SKIP_MODERATION]: true },
    req,
  })
  await req.payload.delete({
    collection: VIOLATIONS_SLUG as CollectionSlug,
    where: { author: { equals: id } },
    overrideAccess: true,
    req,
  })
}
