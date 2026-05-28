import type { Access, Where } from "payload"
import { hasRoleOrAdmin, isAdmin, isStaff } from "./roles"

/**
 * Access Control Policies
 *
 * Naming Conventions:
 * - Complex state and ownership checks with role exceptions use `is[Condition]Or[Role]` format
 *   (e.g., `isCreatedByOrEditor`, `isPublishedOrStaff`, `isDraftOrEditor`, `isSelfOrAdmin`).
 */

/** Allows admins, or the user matching their own user record (by id). */
export const isSelfOrAdmin: Access = ({ req: { user } }) => {
  if (!user) {
    return false
  }

  return (
    isAdmin(user) || {
      id: { equals: user.id },
    }
  )
}

/** Allows editors+, or the user who created the document. */
export const isCreatedByOrEditor: Access = ({ req: { user } }) => {
  if (!user) {
    return false
  }

  return (
    hasRoleOrAdmin(user, "editor") || {
      createdBy: { equals: user.id },
    }
  )
}

/**
 * Restricts updates to drafts only for writers (and requires ownership), while allowing editors.
 * All other roles (such as narrators and members) are implicitly denied update access.
 */
export const isDraftOrEditor: Access = ({ req: { user }, data }) => {
  if (!user) {
    return false
  }

  if (hasRoleOrAdmin(user, "editor")) {
    return true
  }

  if (!hasRoleOrAdmin(user, "writer")) {
    return false
  }

  if (data?._status === "published") {
    return false
  }

  return {
    and: [{ createdBy: { equals: user.id } } as Where, { _status: { equals: "draft" } } as Where],
  }
}

/** Allows staff to view all statuses, while restricting others to published items only. */
export const isPublishedOrStaff: Access = ({ req: { user } }) => {
  if (isStaff(user)) {
    return true
  }

  return {
    _status: {
      equals: "published",
    },
  }
}
