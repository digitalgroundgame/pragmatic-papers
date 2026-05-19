import type { Access } from "payload"
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
    createdBy: { equals: user.id },
    _status: { equals: "draft" },
  }
}
