import type { CollectionSlug, Payload, PayloadRequest, Where } from "payload"

import { markSeeded, wasSeeded } from "@/utilities/seedOnce"

import { ACHIEVEMENTS_SLUG, AWARDING, AWARDS_SLUG } from "./constants"
import { relationId } from "./evaluate"
import { starterAchievements } from "./rules"
import type {
  AchievementDoc,
  AchievementRow,
  AchievementUser,
  ResolvedAchievementsConfig,
} from "./types"

const countRows = async (payload: Payload, where: Where, req?: PayloadRequest): Promise<number> =>
  (
    await payload.count({
      collection: AWARDS_SLUG as CollectionSlug,
      where,
      overrideAccess: true,
      req,
    })
  ).totalDocs

const createAward = (
  payload: Payload,
  achievementId: number | string,
  userId: number | string,
  req?: PayloadRequest,
) =>
  payload.create({
    collection: AWARDS_SLUG as CollectionSlug,
    data: {
      user: userId,
      achievement: achievementId,
      earnedAt: new Date().toISOString(),
    } as never,
    overrideAccess: true,
    context: { [AWARDING]: true },
    req,
  })

/** The achievements earned by being one of the first members (`firstMembers`). */
export async function firstMembersAchievements(
  payload: Payload,
  req?: PayloadRequest,
): Promise<AchievementDoc[]> {
  const { docs } = await payload.find({
    collection: ACHIEVEMENTS_SLUG as CollectionSlug,
    where: { rule: { equals: "firstMembers" } },
    depth: 0,
    pagination: false,
    overrideAccess: true,
    req,
  })
  return docs as unknown as AchievementDoc[]
}

/**
 * Awards a `firstMembers` achievement to one account, if it hasn't a row for it yet and fewer
 * than the limit have been awarded. Revoked rows, and rows whose account was deleted, still
 * count, so it never passes down to a later member: an account's place is fixed when it's
 * made. Returns whether it awarded one.
 */
export async function awardFirstMember(
  payload: Payload,
  achievement: AchievementDoc,
  userId: number | string,
  req?: PayloadRequest,
): Promise<boolean> {
  const mine = { achievement: { equals: achievement.id } }
  const already = await countRows(payload, { and: [{ user: { equals: userId } }, mine] }, req)
  if (already > 0) return false
  if ((await countRows(payload, mine, req)) >= (achievement.limit ?? 0)) return false
  await createAward(payload, achievement.id, userId, req)
  return true
}

const PAGE = 500

/**
 * Awards a `firstMembers` achievement to the member accounts that should have it and don't, in
 * sign-up order, until it reaches its limit: when it's created, when its limit is raised, and
 * for one seeded on a site that already has members. From then on each new member is awarded
 * as their account is made. Returns how many it awarded.
 */
export async function fillFirstMembers(
  payload: Payload,
  achievement: AchievementDoc,
  config: ResolvedAchievementsConfig,
  req?: PayloadRequest,
): Promise<number> {
  const limit = achievement.limit ?? 0
  const { docs: rows } = await payload.find({
    collection: AWARDS_SLUG as CollectionSlug,
    where: { achievement: { equals: achievement.id } },
    depth: 0,
    pagination: false,
    select: { user: true },
    overrideAccess: true,
    req,
  })
  const holders = new Set((rows as unknown as AchievementRow[]).map((row) => relationId(row.user)))
  let total = rows.length
  let awarded = 0
  for (let page = 1; total < limit; page++) {
    const { docs, hasNextPage } = await payload.find({
      collection: config.usersSlug,
      sort: "createdAt",
      depth: 0,
      limit: PAGE,
      page,
      select: Object.fromEntries(config.userFields.map((field) => [field, true])),
      overrideAccess: true,
      req,
    })
    for (const user of docs as unknown as AchievementUser[]) {
      if (total >= limit) break
      if (!config.isMember(user) || holders.has(String(user.id))) continue
      await createAward(payload, achievement.id, user.id, req)
      awarded++
      total++
    }
    if (!hasNextPage) break
  }
  if (awarded) {
    payload.logger.info({ achievement: achievement.name, awarded }, "Awarded to existing members")
  }
  return awarded
}

/**
 * Creates the achievements a site starts with (`starterAchievements`), each once per site: one
 * an editor deletes stays deleted. Then fills every `firstMembers` achievement the site has
 * (`fillFirstMembers`), so members an earlier fill missed get theirs on the next deploy, whoever
 * created it. Returns the names it created.
 */
export async function seedAchievements(
  payload: Payload,
  config: ResolvedAchievementsConfig,
): Promise<string[]> {
  if (config.disabled) return []
  const created: string[] = []
  for (const { key, ...data } of starterAchievements(config)) {
    if (await wasSeeded(payload, ACHIEVEMENTS_SLUG, key)) continue
    // Two deploys can seed the same database at once (the site's and the Worker's), so one
    // already there by name and rule counts as seeded too.
    const { totalDocs } = await payload.count({
      collection: ACHIEVEMENTS_SLUG as CollectionSlug,
      where: { and: [{ name: { equals: data.name } }, { rule: { equals: data.rule } }] },
      overrideAccess: true,
    })
    if (totalDocs) {
      await markSeeded(payload, ACHIEVEMENTS_SLUG, key)
      continue
    }
    await payload.create({
      collection: ACHIEVEMENTS_SLUG as CollectionSlug,
      data: data as never,
      overrideAccess: true,
    })
    await markSeeded(payload, ACHIEVEMENTS_SLUG, key)
    created.push(data.name)
  }
  for (const achievement of await firstMembersAchievements(payload)) {
    await fillFirstMembers(payload, achievement, config)
  }
  return created
}
