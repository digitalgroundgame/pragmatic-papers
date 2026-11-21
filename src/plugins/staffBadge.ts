import type { Role } from "@/access/roles"
import type { BadgeInfo } from "@/plugins/comments"

/**
 * The badge each staff role shows beside its comments, most senior first: a staff member with
 * several roles shows the first of theirs. "Staff writer", so it isn't confused with the
 * Writer mark on an article's own writers.
 */
export const STAFF_BADGES: [Role, string][] = [
  ["admin", "Admin"],
  ["chief-editor", "Chief editor"],
  ["editor", "Editor"],
  ["writer", "Staff writer"],
  ["narrator", "Narrator"],
]

/**
 * The badge for the most senior staff role in `roles`, or null for a reader. Its key is the
 * role's slug.
 */
export function staffBadge(roles: unknown): BadgeInfo | null {
  if (!Array.isArray(roles)) return null
  const found = STAFF_BADGES.find(([role]) => roles.includes(role))
  return found ? { key: found[0], label: found[1] } : null
}
