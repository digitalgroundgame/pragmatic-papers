import type { CollectionConfig, Payload, PayloadRequest } from "payload"

import { isPluginOn, registerPlugin } from "@/utilities/registerPlugin"

import { seedAchievements } from "./award"
import { achievementsCollection, awardsCollection, awardsJoinField } from "./collection"
import { DEFAULT_EARLY_MEMBER_LIMIT } from "./constants"
import { awardOnMembership, deleteUsersAwards } from "./hooks/users"
import { achievementsFor, badgeLabelsFor } from "./read"
import type {
  AchievementUser,
  AchievementsPluginConfig,
  HeldAchievement,
  ResolvedAchievementsConfig,
} from "./types"

export { RULES } from "./rules"
export type { MyAchievements } from "./endpoints/mine"
export type {
  AchievementDoc,
  AchievementRule,
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
 * with: the badge beside each name (for comments), each user's achievements (for public
 * pages), and the achievements a site starts with, which a deploy creates once.
 */
export function achievementsReader(options: AchievementsPluginConfig): {
  badgesFor: (users: AchievementUser[], req: PayloadRequest) => Promise<Map<string, string>>
  heldBy: (payload: Payload, user: AchievementUser) => Promise<HeldAchievement[]>
  seed: (payload: Payload) => Promise<string[]>
} {
  const config = resolveAchievementsConfig(options)
  return {
    badgesFor: (users, req) => badgeLabelsFor(req.payload, users, config, req),
    heldBy: async (payload, user) =>
      (await achievementsFor(payload, [user], config)).get(String(user.id)) ?? [],
    seed: (payload) => seedAchievements(payload, config),
  }
}

/**
 * Readers' achievements, defined by editors in the admin, each earned by a rule in code: a fact
 * about the account (Verified), being one of the first members (Early member), or given by
 * hand. Each can show a badge beside the holder's name on comments. Moderators give and revoke
 * them from a user's record, with a reason, and the row stays as a record. Switched off, no
 * achievement shows anywhere, but first-members achievements are still awarded, so the order
 * holds when it's switched on.
 */
export const achievementsPlugin = registerPlugin<AchievementsPluginConfig>({
  slug: "achievements",
  manifest: {
    name: "Achievements",
    source: "src/plugins/achievements",
    description:
      "Readers' achievements, defined by editors in Content → Achievements and earned by rules in code (Verified, Early member, or given by hand), with a badge beside their name on comments. Moderators give and revoke them from a user's record.",
    switch: {
      label: "Achievements",
      description:
        "Badges beside readers' names on comments, and achievements on their account page. First-members achievements are still awarded while it's off.",
      defaultValue: false,
    },
  },
  plugin: ({ config, plugins: _plugins, ...options }) => {
    const achievements = resolveAchievementsConfig(options)
    const collections = (config.collections ?? []).map((existing): CollectionConfig => {
      if (existing.slug !== achievements.usersSlug || achievements.disabled) return existing
      return {
        ...existing,
        fields: [...existing.fields, awardsJoinField(achievements)],
        hooks: {
          ...existing.hooks,
          afterChange: [...(existing.hooks?.afterChange ?? []), awardOnMembership(achievements)],
          beforeDelete: [...(existing.hooks?.beforeDelete ?? []), deleteUsersAwards],
        },
      }
    })
    return {
      ...config,
      collections: [
        ...collections,
        achievementsCollection(achievements),
        awardsCollection(achievements),
      ],
    }
  },
})
