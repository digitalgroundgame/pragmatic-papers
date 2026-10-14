import type { CollectionSlug, Payload, PayloadRequest } from "payload"

import { ACHIEVEMENTS_SLUG, AWARDS_SLUG } from "./constants"
import { heldAchievements, rowUserId, topBadge } from "./evaluate"
import type {
  AchievementDoc,
  AchievementRow,
  AchievementUser,
  HeldAchievement,
  ResolvedAchievementsConfig,
} from "./types"

/** Every achievement editors have defined, in the order they gave them. */
export async function loadAchievements(
  payload: Payload,
  req?: PayloadRequest,
): Promise<AchievementDoc[]> {
  const { docs } = await payload.find({
    collection: ACHIEVEMENTS_SLUG as CollectionSlug,
    sort: "_order",
    depth: 0,
    pagination: false,
    overrideAccess: true,
    req,
  })
  return docs as unknown as AchievementDoc[]
}

/** Every award of these users, one query, grouped by user ID. */
async function rowsByUser(
  payload: Payload,
  ids: string[],
  req?: PayloadRequest,
): Promise<Map<string, AchievementRow[]>> {
  const grouped = new Map<string, AchievementRow[]>()
  if (!ids.length) return grouped
  const { docs } = await payload.find({
    collection: AWARDS_SLUG as CollectionSlug,
    where: { user: { in: ids } },
    depth: 0,
    pagination: false,
    select: { user: true, achievement: true, earnedAt: true, revoked: true },
    overrideAccess: true,
    req,
  })
  for (const row of docs as unknown as AchievementRow[]) {
    const id = rowUserId(row)
    if (id === null) continue
    grouped.set(id, [...(grouped.get(id) ?? []), row])
  }
  return grouped
}

/**
 * Each user's achievements, keyed by user ID. The users must carry the fields the rules read
 * (`userFields`). Empty while the plugin is switched off.
 */
export async function achievementsFor(
  payload: Payload,
  users: AchievementUser[],
  config: ResolvedAchievementsConfig,
  req?: PayloadRequest,
): Promise<Map<string, HeldAchievement[]>> {
  const result = new Map<string, HeldAchievement[]>()
  if (!users.length || !(await config.enabled(payload))) return result
  const unique = [...new Map(users.map((user) => [String(user.id), user])).values()]
  const [achievements, rows] = await Promise.all([
    loadAchievements(payload, req),
    rowsByUser(
      payload,
      unique.map((user) => String(user.id)),
      req,
    ),
  ])
  for (const user of unique) {
    const held = heldAchievements(user, rows.get(String(user.id)) ?? [], achievements, config)
    result.set(String(user.id), held)
  }
  return result
}

/** The one badge to show beside each user's name, for those who hold any. */
export async function badgeLabelsFor(
  payload: Payload,
  users: AchievementUser[],
  config: ResolvedAchievementsConfig,
  req?: PayloadRequest,
): Promise<Map<string, string>> {
  const labels = new Map<string, string>()
  for (const [id, held] of await achievementsFor(payload, users, config, req)) {
    const label = topBadge(held)
    if (label) labels.set(id, label)
  }
  return labels
}
