import type { CollectionSlug, Payload, PayloadRequest, Where } from "payload"

import { READS_SLUG, VISITS_FIELD } from "./constants"
import { afterVisit, visitsOf } from "./days"
import type { ReadingUser, ResolvedReadingConfig } from "./types"

/**
 * Counts a visit on `day`, the reader's calendar day. A second visit the same day changes
 * nothing, so this writes at most once a day per reader. It writes straight to the database:
 * through `payload.update` it would run the users collection's hooks, which revalidate pages,
 * on every reader's first visit of the day.
 */
export async function recordVisit(
  payload: Payload,
  user: ReadingUser,
  day: string,
  config: ResolvedReadingConfig,
  req?: Partial<PayloadRequest>,
): Promise<boolean> {
  const next = afterVisit(visitsOf(user, VISITS_FIELD), day)
  if (!next) return false
  await payload.db.updateOne({
    collection: config.usersSlug,
    id: user.id,
    data: { [VISITS_FIELD]: next },
    returning: false,
    req,
  })
  return true
}

/** Whether `id` is a published article. */
async function isPublished(
  payload: Payload,
  id: number | string,
  config: ResolvedReadingConfig,
  req?: Partial<PayloadRequest>,
): Promise<boolean> {
  const { totalDocs } = await payload.count({
    collection: config.articlesSlug,
    where: { and: [{ id: { equals: id } }, { _status: { equals: "published" } }] },
    overrideAccess: true,
    req,
  })
  return totalDocs > 0
}

/**
 * Records that `user` read `article`, once: a second read of the same article changes nothing.
 * Only published articles count, so a draft preview never does. True when it made a new row.
 */
export async function recordRead(
  payload: Payload,
  user: ReadingUser,
  article: number | string,
  config: ResolvedReadingConfig,
  req?: Partial<PayloadRequest>,
): Promise<boolean> {
  if (!(await isPublished(payload, article, config, req))) return false
  const where: Where = { and: [{ user: { equals: user.id } }, { article: { equals: article } }] }
  const { totalDocs } = await payload.count({
    collection: READS_SLUG as CollectionSlug,
    where,
    overrideAccess: true,
    req,
  })
  if (totalDocs > 0) return false
  try {
    await payload.create({
      collection: READS_SLUG as CollectionSlug,
      data: { user: user.id, article, readAt: new Date().toISOString() } as never,
      overrideAccess: true,
      depth: 0,
      req,
    })
    return true
  } catch (err) {
    // Two tabs finishing the same article at once: the unique index keeps one row.
    payload.logger.debug({ err }, "[reading] read already recorded")
    return false
  }
}
