import type { Access } from "payload"
import { atLeast } from "./roles"

export const adminOrSelf: Access = ({ req: { user } }) => {
  if (!user) {
    return false
  }

  return (
    atLeast(user, "admin") || {
      id: { equals: user.id },
    }
  )
}
