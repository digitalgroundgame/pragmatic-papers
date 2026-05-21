import type { Access, Where } from "payload"
import { hasRole, ADMIN_ROLES, EDITOR_ROLES } from "./roles"

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

export const authenticatedOrPublished: Access = ({ req: { user } }) => {
  if (user) {
    return true
  }

  return {
    _status: {
      equals: "published",
    },
  }
}
