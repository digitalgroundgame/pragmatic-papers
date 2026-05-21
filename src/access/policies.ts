import type { Access, Where } from "payload"
import { hasRole, ADMIN_ROLES, EDITOR_ROLES, STAFF_ROLES } from "./roles"

/** Allows admins, or the user matching their own user record (by id). */
export const adminOrSelf: Access = ({ req: { user } }) => {
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
export const editorOrSelf: Access = ({ req: { user } }) => {
  if (!user) {
    return false
  }

  return (
    hasRole(user, EDITOR_ROLES) || {
      createdBy: { equals: user.id },
    }
  )
}

export const restrictWritersToDraftOnly: Access = ({ req: { user } }) => {
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

export const staffOrPublished: Access = ({ req: { user } }) => {
  if (hasRole(user, STAFF_ROLES)) {
    return true
  }

  return {
    _status: {
      equals: "published",
    },
  }
}
