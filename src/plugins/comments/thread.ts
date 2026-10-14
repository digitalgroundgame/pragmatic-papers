import type { AuthorDisplay, CommentAuthor, CommentStatus, PublicComment } from "./types"

/** A comment as the thread endpoint reads it, its author populated. */
export interface StoredComment {
  id: number | string
  body?: string | null
  createdAt: string
  status: CommentStatus
  depth?: number | null
  parent?: number | string | { id: number | string } | null
  author?: CommentAuthor | number | string | null
}

const idOf = (value: StoredComment["parent"] | StoredComment["author"]) =>
  value && typeof value === "object" ? value.id : (value ?? null)

/**
 * The comments one viewer sees on a document, oldest first: every published comment, the
 * viewer's own held ones, and a placeholder for each comment that's gone but still has
 * replies showing, so they keep their place. The page builds the tree from `parentId`.
 */
export function buildThread(
  stored: StoredComment[],
  viewerId: number | string | null,
  describeAuthor: (author: CommentAuthor) => AuthorDisplay,
): PublicComment[] {
  const byId = new Map(stored.map((comment) => [String(comment.id), comment]))
  const isOwnHeld = (comment: StoredComment) =>
    comment.status === "auto-hidden" &&
    viewerId !== null &&
    String(idOf(comment.author)) === String(viewerId)
  const isShown = (comment: StoredComment) =>
    (comment.status === "published" && typeof comment.author === "object" && !!comment.author) ||
    isOwnHeld(comment)

  // Every comment that's shown, and every ancestor it needs to hang from.
  const kept = new Set<string>()
  for (const comment of stored) {
    if (!isShown(comment)) continue
    let current: StoredComment | undefined = comment
    while (current && !kept.has(String(current.id))) {
      kept.add(String(current.id))
      const parentId = idOf(current.parent)
      current = parentId === null ? undefined : byId.get(String(parentId))
    }
  }

  return stored
    .filter((comment) => kept.has(String(comment.id)))
    .map((comment): PublicComment => {
      const base = {
        id: comment.id,
        parentId: idOf(comment.parent),
        depth: comment.depth ?? 0,
        createdAt: comment.createdAt,
      }
      if (!isShown(comment)) return { ...base, body: "", author: null, removed: true }
      return {
        ...base,
        body: comment.body ?? "",
        author: describeAuthor(comment.author as CommentAuthor),
        ...(comment.status !== "published" && { held: true as const }),
      }
    })
}
