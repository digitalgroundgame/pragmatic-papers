import type { Access, FieldAccess } from "payload"
import { atLeast } from "./roles"

export const writer: Access = ({ req: { user } }) => {
  return atLeast(user, "writer")
}

export const writerFieldLevel: FieldAccess = ({ req: { user } }) => {
  return atLeast(user, "writer")
}
