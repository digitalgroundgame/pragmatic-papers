import type { AchievementRule, AchievementSeed, ResolvedAchievementsConfig } from "./types"

/**
 * How an achievement is earned. The rules are code; editors define achievements in the admin
 * and pick one, filling in what it asks for (a number of members). A rule is one of:
 *
 * - `account`: a fact about the account, worked out from the user record each time it's read.
 * - `awarded`: earned once and kept as a row, so it never moves when other accounts change.
 * - `manual`: given by a moderator from the user's record.
 *
 * Whatever the rule, a moderator can revoke it, which is a row with `revoked` ticked.
 */
export const RULES: readonly AchievementRule[] = [
  {
    key: "manual",
    label: "Given by hand",
    description: "Moderators give it from a user's record.",
    source: "manual",
  },
  {
    key: "firstMembers",
    label: "First members",
    description: "The first readers to make an account, in sign-up order, up to the limit.",
    source: "awarded",
  },
  {
    key: "verified",
    label: "Verified email",
    description: "Readers whose sign-in provider verified their email address.",
    source: "account",
    holds: (user, config) => config.isVerified(user),
  },
]

export const findRule = (key: unknown): AchievementRule | undefined =>
  RULES.find((rule) => rule.key === key)

/**
 * The achievements a site starts with, created once per site (`seedAchievements`), in badge
 * order. Editors own them from then on: renamed, reordered or deleted, they stay that way.
 */
export const starterAchievements = (config: ResolvedAchievementsConfig): AchievementSeed[] => [
  {
    key: "early-member",
    name: "Early member",
    description: "One of the first readers to make an account.",
    rule: "firstMembers",
    limit: config.earlyMemberLimit,
    badge: true,
  },
  {
    key: "verified",
    name: "Verified",
    description: "Your sign-in provider verified your email address.",
    rule: "verified",
    badge: true,
  },
]
