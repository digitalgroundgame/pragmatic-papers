import type { Access, Where } from "payload"
import { hasRoleOrAdmin, isAdmin, isEditor, isStaff, STAFF_ROLES } from "./roles"

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

/** Allows staff to view all users, users to view themselves, and anyone to view staff users (authors/narrators/editors). */
export const readUsers: Access = ({ req: { user } }) => {
  if (isStaff(user)) {
    return true
  }

  const constraints: Where[] = [
    {
      roles: {
        in: STAFF_ROLES,
      },
    },
  ]

  if (user?.id) {
    constraints.push({
      id: { equals: user.id },
    })
  }

  return {
    or: constraints,
  }
}

/** Allows editors+, or the user who created the document. */
export const isCreatedByOrEditor: Access = ({ req: { user } }) => {
  if (!user) {
    return false
  }

  return (
    isEditor(user) || {
      createdBy: { equals: user.id },
    }
  )
}

/**
 * Editors and above may update any article. Writers may update their own
 * articles (regardless of status) but may not publish them. All other roles
 * (such as narrators and members) are implicitly denied update access.
 */
export const isDraftOrEditor: Access = ({ req: { user }, data }) => {
  if (!user) {
    return false
  }

  if (isEditor(user)) {
    return true
  }

  if (!hasRoleOrAdmin(user, "writer")) {
    return false
  }

  // Writers may edit their own articles but may not publish them.
  if (data?._status === "published") {
    return false
  }

  return { createdBy: { equals: user.id } }
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
