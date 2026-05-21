import type { Access, Where } from "payload"
import { hasRole, ADMIN_ROLES, EDITOR_ROLES, STAFF_ROLES } from "./roles"

/**
 * Access Control Policies
 *
 * Naming Conventions:
 * - Complex state and ownership checks with role exceptions use the format `is[Condition]Unless[ExemptRole]`
 *   or `is[State]Unless[ExemptRole]` (e.g., `isCreatedByUnlessEditor`, `isPublishedUnlessStaff`, `isDraftUnlessEditor`, `isSelfUnlessAdmin`).
 */

/** Allows admins, or the user matching their own user record (by id). */
export const isSelfUnlessAdmin: Access = ({ req: { user } }) => {
  if (!user) {
    return false
  }

  return (
    hasRole(user, ADMIN_ROLES) || {
      id: { equals: user.id },
    }
  )
}

/** Allows editors+, or the user who created the document. */
export const isCreatedByUnlessEditor: Access = ({ req: { user } }) => {
  if (!user) {
    return false
  }

  return (
    hasRole(user, EDITOR_ROLES) || {
      createdBy: { equals: user.id },
    }
  )
}

/** Restricts updates to drafts only for writers (and requires ownership), while allowing editors. */
export const isDraftUnlessEditor: Access = ({ req: { user } }) => {
  if (!user) {
    return false
  }

  if (hasRole(user, EDITOR_ROLES)) {
    return true
  }

  if (user.role !== "writer") {
    return false
  }

  return {
    and: [{ createdBy: { equals: user.id } } as Where, { _status: { equals: "draft" } } as Where],
  }
}

/** Allows staff to view all statuses, while restricting others to published items only. */
export const isPublishedUnlessStaff: Access = ({ req: { user } }) => {
  if (hasRole(user, STAFF_ROLES)) {
    return true
  }

  return {
    _status: {
      equals: "published",
    },
  }
}
