import type { Access, FieldAccess } from "payload"
import { isWriter } from "./checkRole"

export const writer: Access = ({ req: { user } }) => {
  if (!user) {
    return false
  }
  return isWriter(user)
}

export const writerFieldLevel: FieldAccess = ({ req: { user } }) => {
  if (!user) {
    return false
  }
  return isWriter(user)
}
