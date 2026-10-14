import type { CollectionSlug, Payload, PayloadRequest, Where } from "payload"

import { markSeeded, wasSeeded } from "@/utilities/seedOnce"

import { ACHIEVEMENTS_SLUG, AWARDING, BACKFILL_KEY, EARLY_MEMBER } from "./constants"
import type { AchievementUser, ResolvedAchievementsConfig } from "./types"

const countRows = async (payload: Payload, where: Where, req?: PayloadRequest): Promise<number> =>
  (
    await payload.count({
      collection: ACHIEVEMENTS_SLUG as CollectionSlug,
      where,
      overrideAccess: true,
      req,
    })
  ).totalDocs

/**
 * Awards Early member to one account, if it hasn't a row for it yet and fewer than the limit
 * have been awarded. Revoked rows, and rows whose account was deleted, still count, so it never
 * passes down to a later member: an account's place is fixed when it's made. Returns whether
 * it awarded one.
 */
export async function awardEarlyMember(
  payload: Payload,
  userId: number | string,
  config: ResolvedAchievementsConfig,
  req?: PayloadRequest,
): Promise<boolean> {
  if (config.disabled) return false
  const already = await countRows(
    payload,
    { and: [{ user: { equals: userId } }, { achievement: { equals: EARLY_MEMBER } }] },
    req,
  )
  if (already > 0) return false
  const awarded = await countRows(payload, { achievement: { equals: EARLY_MEMBER } }, req)
  if (awarded >= config.earlyMemberLimit) return false
  await payload.create({
    collection: ACHIEVEMENTS_SLUG as CollectionSlug,
    data: {
      user: userId,
      achievement: EARLY_MEMBER,
      earnedAt: new Date().toISOString(),
    } as never,
    overrideAccess: true,
    context: { [AWARDING]: true },
    req,
  })
  return true
}

const PAGE = 500

/**
 * Awards Early member to the member accounts made before achievements shipped, in sign-up
 * order, up to the limit. Runs once per site (`seedOnce`), when a deploy goes live: from then
 * on each new member is awarded as their account is made. Returns how many it awarded, or null
 * when it had already run.
 */
export async function backfillEarlyMembers(
  payload: Payload,
  config: ResolvedAchievementsConfig,
): Promise<number | null> {
  if (config.disabled) return null
  if (await wasSeeded(payload, BACKFILL_KEY.collection, BACKFILL_KEY.slug)) return null

  let awarded = 0
  let total = await countRows(payload, { achievement: { equals: EARLY_MEMBER } })
  for (let page = 1; total < config.earlyMemberLimit; page++) {
    const { docs, hasNextPage } = await payload.find({
      collection: config.usersSlug,
      sort: "createdAt",
      depth: 0,
      limit: PAGE,
      page,
      select: Object.fromEntries(config.userFields.map((field) => [field, true])),
      overrideAccess: true,
    })
    for (const user of docs as unknown as AchievementUser[]) {
      if (total >= config.earlyMemberLimit) break
      if (!config.isMember(user)) continue
      if (await awardEarlyMember(payload, user.id, config)) {
        awarded++
        total++
      }
    }
    if (!hasNextPage) break
  }

  await markSeeded(payload, BACKFILL_KEY.collection, BACKFILL_KEY.slug)
  if (awarded) payload.logger.info({ awarded }, "Awarded Early member to existing members")
  return awarded
}
