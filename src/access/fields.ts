import type { FieldAccess } from "payload"
import { hasRoleOrAdmin, isAdmin, isEditor, isStaff } from "./roles"

export const adminFieldLevel: FieldAccess = ({ req: { user } }) => {
  return isAdmin(user)
}

export const editorFieldLevel: FieldAccess = ({ req: { user } }) => {
  return isEditor(user)
}

export const writerFieldLevel: FieldAccess = ({ req: { user } }) => {
  return hasRoleOrAdmin(user, "writer")
}

export const writerOrEditorFieldLevel: FieldAccess = ({ req: { user } }) => {
  return hasRoleOrAdmin(user, ["writer", "editor"])
}

export const selfOrStaffFieldLevel: FieldAccess = ({ req: { user }, id }) => {
  if (!user) return false
  if (isStaff(user)) return true
  return String(user.id) === String(id)
}
