export const COMMENTS_SLUG = "comments"
export const VIOLATIONS_SLUG = "comment-violations"
export const SETTINGS_SLUG = "comment-settings"

/** What the settings global holds until an admin saves it. */
export const DEFAULT_SETTINGS = {
  maxDepth: 5,
  violationThreshold: 3,
  violationWindowDays: 30,
  maxLinks: 2,
  blockDuplicates: true,
} as const

/** A comment's status. Only `published` is shown to everyone. */
export const COMMENT_STATUSES = ["published", "auto-hidden", "hidden", "deleted"] as const

/** Where a violation came from. */
export const VIOLATION_SOURCES = ["check", "moderator", "block"] as const
