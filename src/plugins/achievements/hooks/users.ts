import type { CollectionAfterChangeHook, CollectionBeforeDeleteHook, CollectionSlug } from "payload"

import { awardFirstMember, firstMembersAchievements } from "../award"
import { AWARDS_SLUG } from "../constants"
import type { AchievementUser, ResolvedAchievementsConfig } from "../types"

/**
 * Awards each `firstMembers` achievement still under its limit when an account becomes a
 * member: made as one in the admin, or given the role by a sign-up (the sign-in library inserts
 * the row, then the site sets its role). An account that was already a member is left alone, so
 * an edit never awards one out of order. A failure is logged rather than thrown, but the awards
 * are written in the save's transaction, so a database error there still fails the save.
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
      for (const achievement of await firstMembersAchievements(req.payload, req)) {
        await awardFirstMember(req.payload, achievement, user.id, req)
      }
    } catch (err) {
      req.payload.logger.error({ err, userId: user.id }, "Awarding achievements failed")
    }
    return doc
  }

/**
 * Deleting an account deletes its awards, except those of `firstMembers` achievements: those
 * stay, without an account, so they still count towards the limit and nobody who signed up
 * later moves up.
 */
export const deleteUsersAwards: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const kept = (await firstMembersAchievements(req.payload, req)).map(
    (achievement) => achievement.id,
  )
  await req.payload.delete({
    collection: AWARDS_SLUG as CollectionSlug,
    where: kept.length
      ? { and: [{ user: { equals: id } }, { achievement: { not_in: kept } }] }
      : { user: { equals: id } },
    overrideAccess: true,
    req,
  })
  await req.payload.update({
    collection: AWARDS_SLUG as CollectionSlug,
    where: { user: { equals: id } },
    data: { user: null } as never,
    overrideAccess: true,
    req,
  })
}
