import type { Access, AccessArgs, FieldAccess } from "payload"
import type { User } from "@/payload-types"

export type Role = "admin" | "chief-editor" | "editor" | "writer" | "narrator" | "member"

export const isAdmin = (user: User | null | undefined): boolean => {
  if (!user?.roles) return false
  const roles = user.roles as Role[]
  return roles.includes("admin") || roles.includes("chief-editor")
}

/** Checks if a user has a specific role or one of a list of roles exactly. */
export const hasRole = (user: User | null | undefined, roleOrRoles: Role | Role[]): boolean => {
  if (!user?.roles) return false
  const targetRoles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles]
  return (user.roles as Role[]).some((r) => targetRoles.includes(r))
}

/** Checks if a user is an admin/chief-editor, or has the specified role(s). */
export const hasRoleOrAdmin = (
  user: User | null | undefined,
  roleOrRoles: Role | Role[],
): boolean => {
  return isAdmin(user) || hasRole(user, roleOrRoles)
}

export const isStaff = (user: User | null | undefined): boolean => {
  return hasRoleOrAdmin(user, ["editor", "writer", "narrator"])
}

export const anyone: Access = () => true

type isAuthenticated = (args: AccessArgs<User>) => boolean

export const authenticated: isAuthenticated = ({ req: { user } }) => {
  return Boolean(user)
}

export const admin: Access = ({ req: { user } }) => {
  return isAdmin(user)
}

export const adminFieldLevel: FieldAccess = ({ req: { user } }) => {
  return isAdmin(user)
}

export const editor: Access = ({ req: { user } }) => {
  return hasRoleOrAdmin(user, "editor")
}

export const editorFieldLevel: FieldAccess = ({ req: { user } }) => {
  return hasRoleOrAdmin(user, "editor")
}

export const writer: Access = ({ req: { user } }) => {
  return hasRoleOrAdmin(user, "writer")
}

export const writerFieldLevel: FieldAccess = ({ req: { user } }) => {
  return hasRoleOrAdmin(user, "writer")
}

export const staff = ({ req: { user } }: AccessArgs<User>): boolean => {
  return isStaff(user)
}
