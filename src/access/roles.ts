import type { Access, AccessArgs, FieldAccess } from "payload"
import type { User } from "@/payload-types"

export type Role = NonNullable<User["role"]>

export const ADMIN_ROLES: Role[] = ["admin", "chief-editor"]
export const EDITOR_ROLES: Role[] = ["admin", "chief-editor", "editor"]
export const WRITER_ROLES: Role[] = ["admin", "chief-editor", "editor", "writer"]
export const STAFF_ROLES: Role[] = ["admin", "chief-editor", "editor", "writer", "narrator"]

export const hasRole = (user: User | null | undefined, roles: Role[]): boolean => {
  if (!user?.role) return false
  return roles.includes(user.role as Role)
}

export const isStaff = (user: User | null | undefined): boolean => {
  return hasRole(user, STAFF_ROLES)
}

export const anyone: Access = () => true

type isAuthenticated = (args: AccessArgs<User>) => boolean

export const authenticated: isAuthenticated = ({ req: { user } }) => {
  return Boolean(user)
}

export const admin: Access = ({ req: { user } }) => {
  return hasRole(user, ADMIN_ROLES)
}

export const adminFieldLevel: FieldAccess = ({ req: { user } }) => {
  return hasRole(user, ADMIN_ROLES)
}

export const editor: Access = ({ req: { user } }) => {
  return hasRole(user, EDITOR_ROLES)
}

export const editorFieldLevel: FieldAccess = ({ req: { user } }) => {
  return hasRole(user, EDITOR_ROLES)
}

export const writer: Access = ({ req: { user } }) => {
  return hasRole(user, WRITER_ROLES)
}

export const writerFieldLevel: FieldAccess = ({ req: { user } }) => {
  return hasRole(user, WRITER_ROLES)
}

export const staff = ({ req: { user } }: AccessArgs<User>): boolean => {
  return isStaff(user)
}
