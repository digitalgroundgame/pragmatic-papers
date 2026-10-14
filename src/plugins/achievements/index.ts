import type { CollectionConfig, Payload, PayloadRequest } from "payload"

import { isPluginOn, registerPlugin } from "@/utilities/registerPlugin"

import { backfillEarlyMembers } from "./award"
import { achievementsCollection } from "./collection"
import { DEFAULT_EARLY_MEMBER_LIMIT } from "./constants"
import { awardOnMembership, deleteUsersAchievements } from "./hooks/users"
import { badgeLabelsFor } from "./read"
import type { AchievementUser, AchievementsPluginConfig, ResolvedAchievementsConfig } from "./types"

export { ACHIEVEMENTS } from "./registry"
export type { MyAchievements } from "./endpoints/mine"
export type {
  AchievementBadge,
  AchievementDefinition,
  AchievementUser,
  AchievementsPluginConfig,
  HeldAchievement,
} from "./types"

/** The plugin's options with their defaults filled in. */
export const resolveAchievementsConfig = (
  options: AchievementsPluginConfig,
): ResolvedAchievementsConfig => ({
  usersSlug: "users",
  isVerified: (user) => user.emailVerified === true,
  userFields: ["emailVerified", "roles"],
  earlyMemberLimit: DEFAULT_EARLY_MEMBER_LIMIT,
  adminGroup: "Content",
  ...options,
  disabled: options.disabled === true,
  enabled: async (payload) => !options.disabled && (await isPluginOn(options.enabled, payload)),
})

/**
 * What the rest of the site asks the achievements plugin, with the options it was installed
 * with: the badge beside each name (for comments), and the one-time Early member backfill a
 * deploy runs.
 */
export function achievementsReader(options: AchievementsPluginConfig): {
  badgesFor: (users: AchievementUser[], req: PayloadRequest) => Promise<Map<string, string>>
  backfillEarlyMembers: (payload: Payload) => Promise<number | null>
} {
  const config = resolveAchievementsConfig(options)
  return {
    badgesFor: (users, req) => badgeLabelsFor(req.payload, users, config, req),
    backfillEarlyMembers: (payload) => backfillEarlyMembers(payload, config),
  }
}

/**
 * Readers' achievements: Verified, worked out from the account, and Early member, awarded to
 * the first member accounts as they're made. Each shows a badge beside the holder's name on
 * comments. Moderators revoke either in the admin, with a reason, and the row stays as a
 * record. Switched off, no achievement shows anywhere, but Early member is still awarded, so
 * the order holds when it's switched on.
 */
export const achievementsPlugin = registerPlugin<AchievementsPluginConfig>({
  slug: "achievements",
  manifest: {
    name: "Achievements",
    source: "src/plugins/achievements",
    description:
      "Readers' achievements, Verified and Early member, each with a badge beside their name on comments, and listed on their account page. Moderators revoke them in Content → Achievements.",
    switch: {
      label: "Achievements",
      description:
        "Badges beside readers' names on comments, and achievements on their account page. Early member is still awarded while it's off.",
      defaultValue: false,
    },
  },
  plugin: ({ config, plugins: _plugins, ...options }) => {
    const achievements = resolveAchievementsConfig(options)
    const collections = (config.collections ?? []).map((existing): CollectionConfig => {
      if (existing.slug !== achievements.usersSlug || achievements.disabled) return existing
      return {
        ...existing,
        hooks: {
          ...existing.hooks,
          afterChange: [...(existing.hooks?.afterChange ?? []), awardOnMembership(achievements)],
          beforeDelete: [...(existing.hooks?.beforeDelete ?? []), deleteUsersAchievements],
        },
      }
    })
    return { ...config, collections: [...collections, achievementsCollection(achievements)] }
  },
})
