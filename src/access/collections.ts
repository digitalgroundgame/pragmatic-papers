import type { Access, AccessArgs } from "payload"
import type { User } from "@/payload-types"
import { hasRoleOrAdmin, isAdmin, isEditor, isStaff } from "./roles"

export const anyone: Access = () => true

export const authenticated: Access = ({ req: { user } }) => {
  return Boolean(user)
}

export const admin: Access = ({ req: { user } }) => {
  return isAdmin(user)
}

export const editor: Access = ({ req: { user } }) => {
  return isEditor(user)
}

export const writer: Access = ({ req: { user } }) => {
  return hasRoleOrAdmin(user, "writer")
}

export const writerOrEditor: Access = ({ req: { user } }) => {
  return hasRoleOrAdmin(user, ["writer", "editor"])
}

export const staff = ({ req: { user } }: AccessArgs<User>): boolean => {
  // Narrower than `Access` because this is used for the `admin` access
  // property in Users, which rejects `Where` from the return type.
  return isStaff(user)
}
