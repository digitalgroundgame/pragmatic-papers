import type { CollectionAfterChangeHook, CollectionSlug } from "payload"

import { VIOLATIONS_SLUG } from "../constants"

/** Set by the plugin's own writes, which record their violations themselves. */
export const SKIP_MODERATION = "commentsSkipModeration"

const relationId = (value: unknown) =>
  value && typeof value === "object" ? (value as { id: number | string }).id : value

/**
 * Keeps violations in step with a moderator's changes to a comment: hiding a published one
 * counts against its author, and publishing a held or hidden one reverses whatever counted.
 */
export const recordModeration: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  if (operation !== "update" || req.context[SKIP_MODERATION]) return doc
  const from = previousDoc?.status
  const to = doc.status
  if (from === to) return doc

  if (from === "published" && to === "hidden" && doc.author) {
    await req.payload.create({
      collection: VIOLATIONS_SLUG as CollectionSlug,
      data: {
        author: relationId(doc.author),
        comment: doc.id,
        source: "moderator",
        reason: "Hidden by a moderator",
      } as never,
      overrideAccess: true,
      req,
    })
  } else if (to === "published") {
    await req.payload.update({
      collection: VIOLATIONS_SLUG as CollectionSlug,
      where: { comment: { equals: doc.id }, reversed: { not_equals: true } },
      data: { reversed: true } as never,
      overrideAccess: true,
      req,
    })
  }
  return doc
}
