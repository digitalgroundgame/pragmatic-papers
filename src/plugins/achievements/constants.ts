/** The achievements editors define: a name, a description and the rule it's earned by. */
export const ACHIEVEMENTS_SLUG = "achievements"

/** Who holds which achievement, and revocations. Kept off the sidebar: managed from a user. */
export const AWARDS_SLUG = "awards"

/** `GET /api/achievements/mine`: the signed-in reader's achievements, for their account page. */
export const MINE_PATH = "/mine"

/**
 * Marks a write as the plugin's own award (`context`), which may make a row for an achievement
 * that's earned rather than given by hand.
 */
export const AWARDING = "achievementsAwarding"

/** How many member accounts the seeded Early member goes to, unless the host says. */
export const DEFAULT_EARLY_MEMBER_LIMIT = 1000
