import type { PublicComment } from "@/plugins/comments"

export interface CommentNode {
  comment: PublicComment
  replies: CommentNode[]
}

/**
 * Nests a thread's comments under their parents, each level oldest first. A reply whose
 * parent isn't in the list (past the thread's limit) shows at the top level rather than not
 * at all.
 */
export function buildTree(comments: PublicComment[]): CommentNode[] {
  const nodes = new Map(comments.map((comment) => [String(comment.id), { comment, replies: [] }]))
  const roots: CommentNode[] = []
  for (const node of nodes.values()) {
    const parent =
      node.comment.parentId === null ? undefined : nodes.get(String(node.comment.parentId))
    ;(parent ? parent.replies : roots).push(node)
  }
  return roots
}

/** How many comments a reader sees: placeholders for removed ones don't count. */
export function visibleCount(comments: PublicComment[]): number {
  return comments.filter((comment) => !comment.removed).length
}
