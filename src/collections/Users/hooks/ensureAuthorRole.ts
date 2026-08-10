import { CONTRIBUTOR_ROLES, type Role } from "@/access/roles"
import type { User } from "@/payload-types"
import type { CollectionBeforeChangeHook } from "payload"

/**
 * Grants `author` alongside any contributor role, and never removes it.
 *
 * This is what makes stepping down a one-step operation: remove `writer` and
 * the person is left holding `author`, keeping their byline and profile page on
 * work they already published. Relying on whoever edits the user to remember to
 * add `author` would decay immediately, and the failure is silent — the byline
 * simply disappears from the site.
 *
 * Runs before the field-level hooks that enforce `roles`' admin-only update
 * access (`beforeChange - Collection` precedes `beforeChange - Fields`), so a
 * non-admin cannot use this to grant themselves anything: their `roles` payload
 * is stripped wholesale a step later.
 */
export const ensureAuthorRole: CollectionBeforeChangeHook<User> = ({ data }) => {
  const roles = data.roles as Role[] | undefined

  // `roles` is absent on updates that don't touch it — leave those alone.
  if (!Array.isArray(roles)) return data
  if (roles.includes("author")) return data
  if (!roles.some((role) => CONTRIBUTOR_ROLES.includes(role))) return data

  return { ...data, roles: [...roles, "author"] }
}
