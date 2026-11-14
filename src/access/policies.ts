import type { Access, FieldAccess, Where } from "payload"
import { relationshipId } from "@/utilities/relationships"
import { hasRoleOrAdmin, isAdmin, isEditor, isStaff, STAFF_ROLES } from "./roles"

/**
 * Access Control Policies
 *
 * Naming Conventions:
 * - Complex state and ownership checks with role exceptions use `is[Condition]Or[Role]` format
 *   (e.g., `isCreatedByOrEditor`, `isPublishedOrStaff`, `isDraftOrEditor`, `isSelfOrAdmin`).
 */

/** Allows admins, or the user matching their own user record (by id). */
export const isSelfOrAdmin: Access = ({ req: { user } }) => {
  if (!user) {
    return false
  }

  return (
    isAdmin(user) || {
      id: { equals: user.id },
    }
  )
}

/**
 * Allows staff to view all users, users to view themselves, and anyone to view staff users
 * (authors/narrators/editors) and users with a public profile: anyone an article or
 * narration has credited, who keeps their author page after losing a staff role.
 */
export const readUsers: Access = ({ req: { user } }) => {
  if (isStaff(user)) {
    return true
  }

  const constraints: Where[] = [
    {
      roles: {
        in: STAFF_ROLES,
      },
    },
    {
      publicProfile: {
        equals: true,
      },
    },
  ]

  if (user?.id) {
    constraints.push({
      id: { equals: user.id },
    })
  }

  return {
    or: constraints,
  }
}

/** Allows editors+, or the user who created the document. */
export const isCreatedByOrEditor: Access = ({ req: { user } }) => {
  if (!user) {
    return false
  }

  return (
    isEditor(user) || {
      createdBy: { equals: user.id },
    }
  )
}

/**
 * Editors and above may create an article in any state. A writer may create drafts only:
 * publishing is an editor's call, on create as on update (`isDraftOrEditor`). A create
 * that names no `_status` saves a draft.
 */
export const canCreateArticle: Access = ({ req: { user }, data }) => {
  if (isEditor(user)) {
    return true
  }

  if (!hasRoleOrAdmin(user, "writer")) {
    return false
  }

  return data?._status !== "published"
}

/**
 * Editors and above may delete any article. A writer may delete an article they created
 * while it isn't live: taking a live article down is an editor's call.
 */
export const canDeleteArticle: Access = ({ req: { user } }) => {
  if (!user) {
    return false
  }

  if (isEditor(user)) {
    return true
  }

  const ownAndNotLive: Where = {
    and: [{ createdBy: { equals: user.id } }, { _status: { not_equals: "published" } }],
  }
  return ownAndNotLive
}

/**
 * Editors and above may update any article. Writers may update the articles
 * they created or are credited on as an author (regardless of status) but may
 * not publish them. All other roles (such as narrators and members) are
 * implicitly denied update access.
 */
export const isDraftOrEditor: Access = async ({ id, req, data }) => {
  const { user } = req
  if (!user) {
    return false
  }

  if (isEditor(user)) {
    return true
  }

  if (!hasRoleOrAdmin(user, "writer")) {
    return false
  }

  // Writers may edit their own articles but may not publish them.
  if (data?._status === "published") {
    return false
  }

  if (id === undefined) {
    const ownOrCredited: Where = {
      or: [{ createdBy: { equals: user.id } }, { authors: { in: [user.id] } }],
    }
    return ownOrCredited
  }

  // A draft save writes only a version, so authors credited after the article was
  // first saved aren't on the document a `where` would be checked against. Read the
  // latest version instead; never `data`, which is what the writer is sending.
  const latest = await req.payload.findByID({
    collection: "articles",
    id,
    depth: 0,
    disableErrors: true,
    draft: true,
    overrideAccess: true,
    req,
    select: { authors: true, createdBy: true },
  })
  if (!latest) {
    return false
  }

  return [latest.createdBy, ...(latest.authors ?? [])].some(
    (person) => relationshipId(person) === user.id,
  )
}

/**
 * Who chooses an article's comments (open, locked or off) besides moderators: editors, and a
 * writer on an article of their own, in a draft (`isDraftOrEditor`). A writer creating one is
 * creating their own. Once it's live, an editor publishes the writer's choice with the draft.
 */
export const canChooseArticleCommenting: FieldAccess = async ({ id, req, data }) => {
  if (id === undefined) return hasRoleOrAdmin(req.user, "writer") || isEditor(req.user)
  return (await isDraftOrEditor({ id: id as number, req, data })) === true
}

/** Allows staff to view all statuses, while restricting others to published items only. */
export const isPublishedOrStaff: Access = ({ req: { user } }) => {
  if (isStaff(user)) {
    return true
  }

  return {
    _status: {
      equals: "published",
    },
  }
}
