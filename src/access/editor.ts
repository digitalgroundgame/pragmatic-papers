import type { Access, FieldAccess } from "payload"
import { isAdmin, isEditor } from "./checkRole"

export const editor: Access = ({ req: { user } }) => {
  if (!user) {
    return false
  }
  return isEditor(user) || isAdmin(user)
}

export const editorFieldLevel: FieldAccess = ({ req: { user } }) => {
  if (!user) {
    return false
  }
  return isEditor(user) || isAdmin(user)
}
