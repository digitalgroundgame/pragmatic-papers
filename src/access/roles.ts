import type { User } from "@/payload-types"

export type Role = "admin" | "chief-editor" | "editor" | "writer" | "narrator" | "author" | "member"

/**
 * Roles whose profile pages are public: anyone may read these user documents
 * (see `readUsers`), which is what lets Payload resolve `article.authors` and
 * `narration.narrator` for anonymous visitors.
 *
 * `admin` is included because an admin may hold a public profile, even though
 * `BYLINE_ROLES` does not let one be selected as an article author.
 */
export const PUBLIC_PROFILE_ROLES: Role[] = [
  "admin",
  "chief-editor",
  "editor",
  "writer",
  "narrator",
  "author",
]

/**
 * Roles that may be credited on an article, and that the `/authors` index and
 * profile pages list.
 *
 * Authorship is a permanent fact about a published article, while the other
 * roles are permissions that come and go. `author` exists to keep those two
 * apart: when a writer becomes inactive, drop `writer` and leave `author`, and
 * they keep their byline and profile page without retaining any ability to
 * create or edit content. Without it, offboarding someone would silently strip
 * their name from work they had already published.
 */
export const BYLINE_ROLES: Role[] = ["chief-editor", "editor", "writer", "narrator", "author"]

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

/**
 * Checks if a user is staff (editor, writer, narrator, chief-editor, admin).
 * `author` is deliberately excluded — it is a credit, not a permission.
 */
export const isStaff = (user: User | null | undefined): boolean => {
  return hasRoleOrAdmin(user, ["editor", "writer", "narrator"])
}
