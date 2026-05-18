import type { Access, FieldAccess } from "payload"
import { atLeast } from "./roles"

export const admin: Access = ({ req: { user } }) => {
  return atLeast(user, "admin")
}

export const adminFieldLevel: FieldAccess = ({ req: { user } }) => {
  return atLeast(user, "admin")
}
