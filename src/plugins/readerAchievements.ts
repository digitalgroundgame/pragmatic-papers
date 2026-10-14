import type { Payload } from "payload"

import { admin, editor } from "@/access/collections"
import { hasRole, isStaff } from "@/access/roles"
import type { User } from "@/payload-types"

import { type AchievementsPluginConfig, achievementsReader } from "./achievements"
import { ssoOptions } from "./signIn"
import { getSignedInUser } from "./sso"

/**
 * The achievements plugin's options. The comments plugin (the badge beside a commenter's name),
 * the deploy and the seed (the achievements a site starts with) read achievements with them
 * too, so they live here rather than inline in `plugins`.
 */
export const achievementsOptions: AchievementsPluginConfig = {
  // Read from the database on each request, like the comments switch, so switching it off
  // takes every badge away at once.
  enabled: async (payload: Payload) =>
    (await payload.findGlobal({ slug: "plugins", depth: 0 })).switches?.achievements === true,
  currentUser: (req) => getSignedInUser(req, ssoOptions),
  // The sso plugin's field: true once Google or Discord verified the address.
  isVerified: (user) => user.emailVerified === true,
  // Readers only: a staff account never counts towards a first-members achievement.
  isMember: (user) =>
    hasRole(user as unknown as User, "member") && !isStaff(user as unknown as User),
  userFields: ["emailVerified", "roles"],
  // The seeded Early member: the first 1000 member accounts, in sign-up order.
  earlyMemberLimit: 1000,
  moderators: editor,
  admins: admin,
}

/** Achievements, as the comments plugin and the deploy ask for them. */
export const readerAchievements = achievementsReader(achievementsOptions)
