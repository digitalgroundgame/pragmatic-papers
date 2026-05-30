import type { Access, FieldAccess } from "payload"
import { isAdmin } from "./checkRole"

export const admin: Access = ({ req: { user } }) => {
  if (!user) {
    return false
  }
  return isAdmin(user)
}

export const adminFieldLevel: FieldAccess = ({ req: { user } }) => {
  if (!user) {
    return false
  }
  return isAdmin(user)
}
