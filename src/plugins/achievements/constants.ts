/** The collection of awarded and revoked achievements. */
export const ACHIEVEMENTS_SLUG = "achievements"

/** `GET /api/achievements/mine`: the signed-in reader's achievements, for their account page. */
export const MINE_PATH = "/mine"

/**
 * Marks a write as the plugin's own award (`context`), which may make a row that isn't a
 * revocation. A row made in the admin only ever revokes.
 */
export const AWARDING = "achievementsAwarding"

/** How many member accounts get Early member, in sign-up order, unless the host says. */
export const DEFAULT_EARLY_MEMBER_LIMIT = 1000

/** The achievement awarded to the first member accounts. */
export const EARLY_MEMBER = "early-member"

/** The `seedOnce` record the one-time Early member backfill leaves. */
export const BACKFILL_KEY = {
  collection: ACHIEVEMENTS_SLUG,
  slug: "early-member-backfill",
} as const
