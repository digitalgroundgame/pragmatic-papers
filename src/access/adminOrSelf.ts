import type { Access } from "payload"
import { isAdmin } from "./checkRole"

export const adminOrSelf: Access = ({ req: { user } }) => {
  if (!user) {
    return false
  }

  return (
    isAdmin(user) || {
      id: { equals: user.id },
    }
  )
}
