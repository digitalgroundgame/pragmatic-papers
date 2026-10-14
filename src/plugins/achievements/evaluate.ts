import { ACHIEVEMENTS } from "./registry"
import type {
  AchievementDefinition,
  AchievementRow,
  AchievementUser,
  HeldAchievement,
  ResolvedAchievementsConfig,
} from "./types"

export const rowUserId = (row: AchievementRow): string | null =>
  row.user === null || row.user === undefined
    ? null
    : String(typeof row.user === "object" ? row.user.id : row.user)

const priorityOf = (achievement: AchievementDefinition) =>
  achievement.badge?.priority ?? Number.NEGATIVE_INFINITY

/**
 * The achievements a user holds, those with the highest-priority badge first. `rows` are this
 * user's rows: an awarded achievement needs one that isn't revoked, and a revoked row takes
 * away one the account would otherwise have.
 */
export function heldAchievements(
  user: AchievementUser,
  rows: AchievementRow[],
  config: ResolvedAchievementsConfig,
  achievements: readonly AchievementDefinition[] = ACHIEVEMENTS,
): HeldAchievement[] {
  const rowFor = new Map(rows.map((row) => [row.achievement, row]))
  return achievements
    .filter((achievement) => {
      const row = rowFor.get(achievement.key)
      if (row?.revoked) return false
      return achievement.source === "awarded" ? !!row : (achievement.holds?.(user, config) ?? false)
    })
    .sort((a, b) => priorityOf(b) - priorityOf(a))
    .map((achievement) => ({
      key: achievement.key,
      label: achievement.label,
      description: achievement.description,
      badge: achievement.badge?.label ?? null,
      earnedAt:
        achievement.source === "awarded" ? (rowFor.get(achievement.key)?.earnedAt ?? null) : null,
    }))
}

/** The one badge shown beside a user's name: the highest priority of those they hold, if any. */
export const topBadge = (held: HeldAchievement[]): string | null =>
  held.find((achievement) => achievement.badge)?.badge ?? null
