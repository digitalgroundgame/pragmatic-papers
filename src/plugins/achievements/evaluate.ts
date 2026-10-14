import { findRule } from "./rules"
import type {
  AchievementDoc,
  AchievementRow,
  AchievementUser,
  HeldAchievement,
  ResolvedAchievementsConfig,
} from "./types"

/** The ID a relationship value points at, whether it's populated or not. */
export const relationId = (value: AchievementRow["user"]): string | null =>
  value === null || value === undefined
    ? null
    : String(typeof value === "object" ? value.id : value)

export const rowUserId = (row: AchievementRow): string | null => relationId(row.user)

/**
 * The achievements a user holds, in the order editors gave them (`achievements`, sorted by
 * `_order`): the first one with a badge is the one shown beside their name. `rows` are this
 * user's awards: an awarded or hand-given achievement needs one that isn't revoked, and a
 * revoked row takes away one the account would otherwise have. An achievement whose rule is no
 * longer in the code is nobody's.
 */
export function heldAchievements(
  user: AchievementUser,
  rows: AchievementRow[],
  achievements: readonly AchievementDoc[],
  config: ResolvedAchievementsConfig,
): HeldAchievement[] {
  const rowFor = new Map(rows.map((row) => [relationId(row.achievement), row]))
  return achievements
    .filter((achievement) => {
      const rule = findRule(achievement.rule)
      const row = rowFor.get(String(achievement.id))
      if (!rule || row?.revoked) return false
      return rule.source === "account" ? (rule.holds?.(user, config) ?? false) : !!row
    })
    .map((achievement) => ({
      key: String(achievement.id),
      label: achievement.name,
      description: achievement.description ?? "",
      badge: achievement.badge ? achievement.name : null,
      earnedAt: rowFor.get(String(achievement.id))?.earnedAt ?? null,
    }))
}

/** The one badge shown beside a user's name: the first of those they hold, if any. */
export const topBadge = (held: HeldAchievement[]): string | null =>
  held.find((achievement) => achievement.badge)?.badge ?? null
