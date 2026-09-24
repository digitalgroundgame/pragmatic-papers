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

/**
 * Field-level counterpart to the `isSelfOrAdmin` collection policy: only the
 * user themselves, or an admin/chief-editor, may read the field. Used to keep
 * private user fields (`email`, `roles`) locked down now that the `users`
 * collection itself is publicly readable for staff profiles via `readUsers`.
 */
export const selfOrAdminFieldLevel: FieldAccess = ({ req: { user }, id }) => {
  if (!user) return false
  if (isAdmin(user)) return true
  return String(user.id) === String(id)
}
