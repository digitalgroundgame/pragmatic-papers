import type { Access } from "payload"
import { isEditor } from "./checkRole"

export const editorOrSelf: Access = ({ req: { user } }) => {
  if (!user) {
    return false
  }

  return (
    isEditor(user) || {
      createdBy: { equals: user.id },
    }
  )
}

export const restrictWritersToDraftOnly: Access = ({ req: { user }, data }) => {
  if (!user) {
    return false
  }

  return isEditor(user) || (data?._status !== "published" && { createdBy: { equals: user.id } })
}
