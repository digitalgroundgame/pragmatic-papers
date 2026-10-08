import { hasRoleOrAdmin, isStaff } from "@/access/roles"
import type { HelpDoc } from "@/docs"
import type { User } from "@/payload-types"

/** The payload-preferences key the bell keeps each user's read articles under. */
export const HELP_DOCS_PREFERENCE = "help-docs"

export interface HelpDocsPreference {
  read: string[]
}

/** The articles `user` should hear about: all staff, or the roles an article names (plus admins). */
export const helpDocsFor = (docs: HelpDoc[], user: User | null | undefined): HelpDoc[] => {
  if (!isStaff(user)) return []
  return docs.filter((doc) => !doc.audience?.length || hasRoleOrAdmin(user, doc.audience))
}

/**
 * The slugs of `docs` that count as unread: not opened, and published since the account was
 * made, so someone joining the staff doesn't start with every article ever written.
 */
export const unreadHelpDocs = (
  docs: HelpDoc[],
  read: string[],
  userCreatedAt: string | undefined,
): string[] => {
  const joined = userCreatedAt?.slice(0, 10) ?? ""
  return docs
    .filter((doc) => !read.includes(doc.slug) && doc.publishedAt >= joined)
    .map((doc) => doc.slug)
}

/** A stored preference, or nothing read when it's missing or malformed. */
export const readFromPreference = (value: unknown): string[] => {
  const read = (value as Partial<HelpDocsPreference> | null | undefined)?.read
  return Array.isArray(read) ? read.filter((slug): slug is string => typeof slug === "string") : []
}
