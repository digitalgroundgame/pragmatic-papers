import type { Access, FieldAccess } from "payload"
import { atLeast } from "./roles"

export const editor: Access = ({ req: { user } }) => {
  return atLeast(user, "editor")
}

export const editorFieldLevel: FieldAccess = ({ req: { user } }) => {
  return atLeast(user, "editor")
}
