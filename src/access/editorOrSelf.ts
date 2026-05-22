import type { Access, Where } from "payload"
import { atLeast } from "./roles"

export const editorOrSelf: Access = ({ req: { user } }) => {
  if (!user) {
    return false
  }

  return (
    atLeast(user, "editor") || {
      createdBy: { equals: user.id },
    }
  )
}

export const restrictWritersToDraftOnly: Access = ({ req: { user } }) => {
  if (!user) {
    return false
  }

  if (atLeast(user, "editor")) {
    return true
  }

  if (user.role !== "writer") {
    return false
  }

  return {
    and: [{ createdBy: { equals: user.id } } as Where, { _status: { equals: "draft" } } as Where],
  }
}
