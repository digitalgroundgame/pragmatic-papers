import type { Access, CollectionSlug, Payload, PayloadRequest } from "payload"

import type { SitePluginOptions } from "@/utilities/registerPlugin"

/** A row of the users collection, as Payload returns it. */
export type AchievementUser = Record<string, unknown> & { id: number | string }

/** A short label shown beside a holder's name, like "Verified". */
export interface AchievementBadge {
  label: string
  /** Of the badges someone holds, the highest priority is the one shown beside their name. */
  priority: number
}

/** An achievement, as the registry (`ACHIEVEMENTS`) defines it. */
export interface AchievementDefinition {
  key: string
  /** Its name, in the admin and on the account page. */
  label: string
  /** What it means, on the account page. */
  description: string
  /**
   * `account`: a fact about the account, worked out from the user record each time (`holds`).
   * `awarded`: earned once and kept as a row, so it never moves when other accounts change.
   */
  source: "account" | "awarded"
  /** For an `account` achievement: whether this user has it, before any revocation. */
  holds?: (user: AchievementUser, config: ResolvedAchievementsConfig) => boolean
  /** Shown beside the holder's name (on comments). Without one, it's listed but not shown there. */
  badge?: AchievementBadge
}

/** A row of the achievements collection, as the plugin reads it. */
export interface AchievementRow {
  user: number | string | { id: number | string } | null
  achievement: string
  earnedAt?: string | null
  revoked?: boolean | null
}

/** An achievement someone holds, as their account page lists it. */
export interface HeldAchievement {
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
  /** Whether an account counts towards Early member: readers, not staff. */
  isMember: (user: AchievementUser) => boolean
  /** How many member accounts get Early member, in sign-up order. Default 1000. */
  earlyMemberLimit?: number
  /** Who sees achievements in the admin and revokes them. */
  moderators: Access
  /** Who can delete an achievement row, which ends its history. */
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
