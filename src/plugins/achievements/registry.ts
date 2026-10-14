import { EARLY_MEMBER } from "./constants"
import type { AchievementDefinition } from "./types"

/**
 * Every achievement, in code. One is either a fact about the account, worked out from the user
 * record each time it's read (`holds`), or **awarded**: earned once and kept as a row in the
 * achievements collection. Either way a moderator can revoke it, which is a row with `revoked`
 * ticked. One with a `badge` shows it beside the holder's name.
 */
export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  {
    key: EARLY_MEMBER,
    label: "Early member",
    description: "One of the first readers to make an account.",
    source: "awarded",
    badge: { label: "Early member", priority: 20 },
  },
  {
    key: "verified",
    label: "Verified",
    description: "Your sign-in provider verified your email address.",
    source: "account",
    holds: (user, config) => config.isVerified(user),
    badge: { label: "Verified", priority: 10 },
  },
]

export const findAchievement = (key: unknown): AchievementDefinition | undefined =>
  ACHIEVEMENTS.find((achievement) => achievement.key === key)
