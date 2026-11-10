import type { Role } from "@/access/roles"

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

/** The badge for the most senior staff role in `roles`, or null for a reader. */
export function staffBadge(roles: unknown): string | null {
  if (!Array.isArray(roles)) return null
  return STAFF_BADGES.find(([role]) => roles.includes(role))?.[1] ?? null
}
