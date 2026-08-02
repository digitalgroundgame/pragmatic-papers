import type { FieldAccess } from "payload"
import { hasRoleOrAdmin, isAdmin, isEditor } from "./roles"

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
