import type { Access, CollectionSlug, Payload, PayloadRequest } from "payload"

import type { SitePluginOptions } from "@/utilities/registerPlugin"

/** A row of the users collection, as Payload returns it. */
export type AchievementUser = Record<string, unknown> & { id: number | string }

/** How an achievement is earned, as `RULES` defines it. */
export interface AchievementRule {
  key: string
  /** Its name in the admin's rule picker. */
  label: string
  /** What it does, under the picker. */
  description: string
  /**
   * `account`: a fact about the account, worked out from the user record each time (`holds`).
   * `awarded`: earned once and kept as a row, so it never moves when other accounts change.
   * `manual`: given by a moderator from the user's record.
   */
  source: "account" | "awarded" | "manual"
  /** For an `account` rule: whether this user has it, before any revocation. */
  holds?: (user: AchievementUser, config: ResolvedAchievementsConfig) => boolean
}

/** An achievement an editor defined, a row of the achievements collection. */
export interface AchievementDoc {
  id: number | string
  name: string
  description?: string | null
  /** The key of its rule in `RULES`. */
  rule: string
  /** For `firstMembers`: how many member accounts get it. */
  limit?: number | null
  /** Whether it shows beside the holder's name on comments. */
  badge?: boolean | null
}

/** An achievement a site starts with (`starterAchievements`). */
export type AchievementSeed = Omit<AchievementDoc, "id"> & {
  /** Recorded with `markSeeded`, so one an editor deletes stays deleted. */
  key: string
}

type RelationValue = number | string | { id: number | string } | null

/** A row of the awards collection, as the plugin reads it. */
export interface AchievementRow {
  user: RelationValue
  achievement: RelationValue
  earnedAt?: string | null
  revoked?: boolean | null
}

/** An achievement someone holds, as their account page lists it. */
export interface HeldAchievement {
  /** The achievement's ID. */
  key: string
  label: string
  description: string
  /** Its badge's label, if it has one. */
  badge: string | null
  /** When an awarded achievement was earned; null for one worked out from the account. */
  earnedAt: string | null
}

export interface AchievementsPluginConfig extends SitePluginOptions {
  /** The collection holders are in. Default `users`. */
  usersSlug?: CollectionSlug
  /**
   * Who is asking, for `/api/achievements/mine`: a row of `usersSlug`, or null when nobody is
   * signed in. Readers needn't be Payload's `req.user`.
   */
  currentUser: (req: PayloadRequest) => Promise<AchievementUser | null>
  /** Whether the account's email address is verified, for Verified. Default `emailVerified`. */
  isVerified?: (user: AchievementUser) => boolean
  /** The user fields `isVerified` and `isMember` read, which callers must load. */
  userFields?: string[]
  /** Whether an account counts towards a `firstMembers` achievement. */
  isMember: (user: AchievementUser) => boolean
  /** How many member accounts the seeded Early member goes to, in sign-up order. Default 1000. */
  earlyMemberLimit?: number
  /** Who defines achievements in the admin, and gives and revokes them. */
  moderators: Access
  /** Who can delete an achievement or an award, which ends its history. */
  admins: Access
  /** The admin sidebar group. Default `Content`. */
  adminGroup?: string
}

export type ResolvedAchievementsConfig = Required<
  Omit<AchievementsPluginConfig, "disabled" | "enabled">
> & {
  disabled: boolean
  /** Whether achievements show right now: off, nobody's do. */
  enabled: (payload: Payload) => Promise<boolean>
}
