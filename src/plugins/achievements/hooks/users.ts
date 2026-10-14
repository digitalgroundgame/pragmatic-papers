import type { CollectionAfterChangeHook, CollectionBeforeDeleteHook, CollectionSlug } from "payload"

import { awardEarlyMember } from "../award"
import { ACHIEVEMENTS_SLUG, EARLY_MEMBER } from "../constants"
import type { AchievementUser, ResolvedAchievementsConfig } from "../types"

/**
 * Awards Early member when an account becomes a member: made as one in the admin, or given the
 * role by a sign-up (the sign-in library inserts the row, then the site sets its role). An
 * account that was already a member is left alone, so an edit never awards one out of order.
 * A failure is logged: it never stops the account being saved.
 */
export const awardOnMembership =
  (config: ResolvedAchievementsConfig): CollectionAfterChangeHook =>
  async ({ doc, previousDoc, operation, req }) => {
    const user = doc as AchievementUser
    if (!config.isMember(user)) return doc
    if (operation === "update" && previousDoc && config.isMember(previousDoc as AchievementUser)) {
      return doc
    }
    try {
      await awardEarlyMember(req.payload, user.id, config, req)
    } catch (err) {
      req.payload.logger.error({ err, userId: user.id }, "Awarding Early member failed")
    }
    return doc
  }

/**
 * Deleting an account deletes its achievement rows, except Early member: that row stays,
 * without an account, so it still counts towards the limit and nobody who signed up later
 * moves up.
 */
export const deleteUsersAchievements: CollectionBeforeDeleteHook = async ({ id, req }) => {
  await req.payload.delete({
    collection: ACHIEVEMENTS_SLUG as CollectionSlug,
    where: { and: [{ user: { equals: id } }, { achievement: { not_equals: EARLY_MEMBER } }] },
    overrideAccess: true,
    req,
  })
  await req.payload.update({
    collection: ACHIEVEMENTS_SLUG as CollectionSlug,
    where: { user: { equals: id } },
    data: { user: null } as never,
    overrideAccess: true,
    req,
  })
}
