import type { User } from "@/payload-types"

export type Role = "admin" | "chief-editor" | "editor" | "writer" | "narrator" | "member"

/**
 * Roles that count as staff. Single source of truth for both the requester-side
 * check (`isStaff`) and document-side query constraints (e.g. `readUsers`), so
 * adding a staff role only requires editing this list.
 */
export const STAFF_ROLES: Role[] = ["admin", "chief-editor", "editor", "writer", "narrator"]

/** Checks if a user is an admin or chief-editor. */
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

/** Checks if a user is an editor or above (editor, chief-editor, admin). */
export const isEditor = (user: User | null | undefined): boolean => {
  return hasRoleOrAdmin(user, "editor")
}

/** Checks if a user is staff (editor, writer, narrator, chief-editor, admin). */
export const isStaff = (user: User | null | undefined): boolean => {
  return hasRole(user, STAFF_ROLES)
}
