import type { CollectionBeforeDeleteHook, CollectionSlug } from "payload"

import { COMMENTS_SLUG, VIOLATIONS_SLUG } from "../constants"
import type { ResolvedCommentsConfig } from "../types"
import { refreshFirstCommented, SKIP_FIRST_COMMENTED } from "./firstCommented"
import { SKIP_MODERATION } from "./recordModeration"

/**
 * Deletes a document's comments, and their replies, before it goes, then brings each of their
 * authors' first-commented time up to date once, rather than once per comment.
 */
export const deleteCommentsOnTarget =
  (config: ResolvedCommentsConfig): CollectionBeforeDeleteHook =>
  async ({ id, req }) => {
    const authors = await req.payload.findDistinct({
      collection: COMMENTS_SLUG as CollectionSlug,
      field: "author",
      where: { target: { equals: id }, status: { equals: "published" } },
      depth: 0,
      limit: 0,
      overrideAccess: true,
      req,
    })
    await req.payload.delete({
      collection: COMMENTS_SLUG as CollectionSlug,
      where: { target: { equals: id } },
      overrideAccess: true,
      context: { [SKIP_FIRST_COMMENTED]: true },
      req,
    })
    // The slug is the plugin's option, so the generated types can't name the field.
    for (const { author } of authors.values as { author?: number | string | null }[]) {
      if (author !== null && author !== undefined) await refreshFirstCommented(config, author, req)
    }
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
